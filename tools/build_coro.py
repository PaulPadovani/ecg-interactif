"""Prépare les données de la coronarographie simulée à partir de deux vraies images.

Principe : sur une image réelle bien opacifiée, on isole l'arbre coronaire, on reconstruit le fond
sans les vaisseaux (inpainting), puis on calcule pour chaque pixel de vaisseau
  - son « temps d'arrivée » du produit de contraste depuis l'ostium (distance géodésique le long de l'arbre),
  - les occlusions simulées en amont desquelles il se trouve (masque de bits).
Le navigateur recompose ensuite l'image : fond − densité_vaisseau × remplissage(t).
"""
import sys, json, heapq, base64, io
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as ndi
from skimage.filters import frangi

S = 600
import os
HERE = os.path.dirname(os.path.abspath(__file__))
def load(name):
    """Image de travail 600x600 en niveaux de gris, à partir des fichiers sources (Wikimedia Commons)."""
    if name == "lca":   # image 1280x720 : champ circulaire centré
        im = Image.open(os.path.join(HERE, "coro-src", "lca_CAG_PTCA_67Yrs_Male_50.jpg")).convert("L").crop((280, 0, 1000, 720))
    else:               # planche 600x300 « avant / après angioplastie » : on garde la moitié droite (après)
        im = Image.open(os.path.join(HERE, "coro-src", "rca_HWI_PTCA.jpg")).convert("L").crop((300, 0, 600, 300))
    return np.asarray(im.resize((S, S), Image.LANCZOS), dtype=np.float32) / 255.0

def process(name, img, seed, ostium, lesions, block=(), k=31, lo=0.035, hi=0.09, flo=0.05, field=None, extra_block=(), big=None, keep=()):
    H, W = img.shape
    bg0 = cv2.morphologyEx(img, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    V = cv2.GaussianBlur(np.clip(bg0 - img, 0, 1), (0, 0), 1.0)
    yy, xx = np.mgrid[0:H, 0:W]
    F = frangi(cv2.GaussianBlur(img, (0, 0), 0.8), sigmas=[1.5, 2.5, 4, 6], black_ridges=True)
    inner = ndi.binary_erosion(field, iterations=14) if field is not None else np.ones_like(img, bool)
    F = np.where(inner, F, 0); F = F / np.percentile(F[inner], 99.5)
    cand = (V > lo) & ((F > flo) | (V > hi))
    cand = ndi.binary_closing(cand, iterations=1)
    if big is not None:   # zone large (reflux dans le sinus) : fermeture à plus grande échelle, localement
        bx, by, br, bk = big
        bgB = cv2.morphologyEx(img, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (bk, bk)))
        VB = cv2.GaussianBlur(np.clip(bgB - img, 0, 1), (0, 0), 1.5); zone = ((xx - bx) ** 2 + (yy - by) ** 2) < br * br
        V = np.where(zone, np.maximum(V, VB), V); cand |= zone & (VB > 0.06)
    if field is not None: cand &= field
    for (bx, by, br) in list(block) + list(extra_block): cand &= ((xx - bx) ** 2 + (yy - by) ** 2) > br * br
    # Dijkstra depuis la graine : coût faible le long des vaisseaux denses ; on suit aussi la longueur géométrique
    INF = 1e18; cost = np.full(H * W, INF); length = np.zeros(H * W, dtype=np.float32); parent = np.full(H * W, -1, dtype=np.int64)
    sx, sy = seed; s = sy * W + sx
    if not cand[sy, sx]:
        d = np.where(cand, (xx - sx) ** 2 + (yy - sy) ** 2, 10 ** 9); s = int(np.argmin(d)); print(name, "graine déplacée vers", s % W, s // W)
    cost[s] = 0; pq = [(0.0, s)]; order = []
    Vf = V.ravel(); cf = cand.ravel(); done = np.zeros(H * W, bool)
    nb = [(-1, -1, 1.4142), (0, -1, 1), (1, -1, 1.4142), (-1, 0, 1), (1, 0, 1), (-1, 1, 1.4142), (0, 1, 1), (1, 1, 1.4142)]
    while pq:
        c, p = heapq.heappop(pq)
        if done[p]: continue
        done[p] = True; order.append(p); px, py = p % W, p // W
        for dx, dy, dl in nb:
            qx, qy = px + dx, py + dy
            if qx < 0 or qy < 0 or qx >= W or qy >= H: continue
            q = qy * W + qx
            if done[q] or not cf[q]: continue
            nc = c + dl / (Vf[q] + 0.01) ** 1.5
            if nc < cost[q]: cost[q] = nc; length[q] = length[p] + dl; parent[q] = p; heapq.heappush(pq, (nc, q))
    reached = done.reshape(H, W); L = length.reshape(H, W)
    # occlusions : descendance, dans l'arbre des plus courts chemins, des pixels du disque lésionnel
    lab = np.zeros(H * W, dtype=np.uint8)
    for bit, (lx, ly, lr) in enumerate(lesions):
        inles = (((xx - lx) ** 2 + (yy - ly) ** 2) <= lr * lr).ravel(); fl = np.zeros(H * W, bool)
        for p in order:
            pa = parent[p]; fl[p] = inles[p] or (pa >= 0 and fl[pa])
        lab[fl] |= (1 << bit)
    lab = lab.reshape(H, W)
    # temps d'arrivée : 0 = toujours visible (sonde, en amont de l'ostium), 1..250 = normalisé, 255 = jamais
    ox, oy = ostium; d = np.where(reached, (xx - ox) ** 2 + (yy - oy) ** 2, 10 ** 9); o = int(np.argmin(d)); L0 = L.ravel()[o]
    T = L - L0; tmax = np.percentile(T[reached & (T > 0)], 99.5)
    arr = np.full((H, W), 255, np.uint8)
    arr[reached] = np.clip(1 + 249 * np.clip(T[reached], 0, tmax) / tmax, 1, 250).astype(np.uint8)
    arr[reached & (T <= 0)] = 0
    # fond sans vaisseaux : inpainting du masque dilaté, puis grain rapporté
    m = cv2.dilate(reached.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    region = cv2.dilate(reached.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (141, 141))) > 0
    loose = (V > 0.018) & (F > 0.025) & region & ~reached
    if field is not None: loose &= ndi.binary_erosion(field, iterations=10)
    for (kx, ky, kr) in keep: loose &= ((xx - kx) ** 2 + (yy - ky) ** 2) > kr * kr     # zones à ne pas effacer (sonde)
    ll, nl = ndi.label(loose, structure=np.ones((3, 3))); sizes = ndi.sum(loose, ll, range(1, nl + 1)); loose = np.isin(ll, 1 + np.flatnonzero(sizes >= 25))
    m2 = cv2.dilate(loose.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7)))
    mall = ((m > 0) | (m2 > 0)).astype(np.uint8)
    bg = cv2.inpaint((img * 255).astype(np.uint8), mall, 7, cv2.INPAINT_TELEA).astype(np.float32) / 255.0
    bg = np.where(mall > 0, cv2.GaussianBlur(bg, (0, 0), 2.0), bg)
    resid = img - cv2.GaussianBlur(img, (0, 0), 1.5); sd = float(resid[(mall == 0) & (img > 0.08)].std())
    rng = np.random.default_rng(7); noise = cv2.GaussianBlur(rng.normal(0, 1, (H, W)).astype(np.float32), (0, 0), 0.7); noise *= sd / noise.std()
    bg = np.clip(np.where(mall > 0, bg + noise, bg), 0, 1)
    bg = np.maximum(bg, img * (m > 0)) if False else bg
    D = np.clip(bg - img, 0, 1) * (m > 0)
    D = cv2.GaussianBlur(D, (0, 0), 0.6) * (m > 0)
    # propage temps et étiquettes au masque dilaté (plus proche pixel atteint)
    idx = ndi.distance_transform_edt(~reached, return_distances=False, return_indices=True)
    arrN = arr[idx[0], idx[1]]; labN = lab[idx[0], idx[1]]
    arr = np.where(m > 0, arrN, 255).astype(np.uint8); lab = np.where(m > 0, labN, 0).astype(np.uint8)
    scale = float(D.max()); D8 = np.clip(D / scale * 255, 0, 255).astype(np.uint8)
    print(f"{name}: pixels atteints {int(reached.sum())}, bruit {sd:.4f}, densité max {scale:.3f}, tmax {tmax:.0f}px")
    return dict(bg=(bg * 255).astype(np.uint8), D=D8, arr=arr, lab=lab, scale=scale, V=V, reached=reached, F=F)

def compose(r, tau=2.0, occ=0):
    """tau : avancée de l'injection (0..1 → remplissage, >1 = plein) ; occ : masque de bits des occlusions actives"""
    a = r["arr"].astype(np.float32) / 250.0
    w = np.clip((tau - a) / 0.06, 0, 1); w[r["arr"] == 255] = 0; w[r["arr"] == 0] = 1
    if occ: w[(r["lab"] & occ) > 0] = 0
    out = r["bg"].astype(np.float32) - r["D"].astype(np.float32) * r["scale"] * w
    return np.clip(out, 0, 255).astype(np.uint8)

CFG = {
  "lca": dict(seed=(125, 182), ostium=(112, 182), block=[(86, 170, 7)], k=31, lo=0.022, hi=0.08, flo=0.035, big=(133, 168, 40, 75), keep=[(60, 150, 34), (88, 168, 16)],
              lesions=[(214, 192, 12), (318, 181, 11), (155, 216, 10)]),   # bit0 IVA proximale, bit1 IVA moyenne, bit2 circonflexe
  "rca": dict(seed=(340, 4), ostium=(292, 90), block=[], k=35, lo=0.03, hi=0.062, flo=0.05,
              lesions=[(190, 134, 15)]),                                  # bit0 coronaire droite proximale
}
CREDITS = {
  "lca": dict(author="Suyash Dwivedi", license="CC BY-SA 4.0", title="CAG+PTCA 67Yrs Male (50).jpg",
              url="https://commons.wikimedia.org/wiki/File:CAG%2BPTCA_67Yrs_Male_(50).jpg"),
  "rca": dict(author="JHeuser", license="CC BY-SA 3.0", title="HWI PTCA.jpg",
              url="https://commons.wikimedia.org/wiki/File:HWI_PTCA.jpg"),
}
def b64(arr, fmt, **kw):
    buf = io.BytesIO(); Image.fromarray(arr).save(buf, fmt, **kw)
    return ("data:image/jpeg;base64," if fmt == "JPEG" else "data:image/png;base64,") + base64.b64encode(buf.getvalue()).decode()

if __name__ == "__main__":
    check = "--check" in sys.argv; out = {}
    for name, c in CFG.items():
        img = load(name); field = None
        if name == "lca":
            yy, xx = np.mgrid[0:S, 0:S]; field = ((xx - 300) ** 2 + (yy - 300) ** 2) < 283 ** 2
        r = process(name, img, c["seed"], c["ostium"], c["lesions"], block=c["block"], k=c["k"], lo=c["lo"], hi=c["hi"], flo=c["flo"], field=field, big=c.get("big"), keep=c.get("keep", ()))
        if check:   # planche de contrôle : original, fond, mi-injection, plein, puis chaque occlusion
            tiles = [(img * 255).astype(np.uint8), r["bg"], compose(r, 0.35), compose(r, 2.0)] + [compose(r, 2.0, 1 << b) for b in range(len(c["lesions"]))]
            Image.fromarray(np.hstack(tiles)).save(os.path.join(HERE, f"check_{name}.jpg"), quality=85)
        pack = np.dstack([r["D"], r["arr"], r["lab"]])      # R = densité du vaisseau, V = temps d'arrivée, B = occlusions d'amont
        out[name] = dict(size=S, scale=round(r["scale"], 4), lesions=[list(l) for l in c["lesions"]], credit=CREDITS[name],
                         bg=b64(r["bg"], "JPEG", quality=84), map=b64(pack, "PNG", optimize=True))
    js = ("// Données de la coronarographie simulée. Fichier généré par tools/build_coro.py : ne pas modifier à la main.\n"
          "// Images dérivées de vraies coronarographies (Wikimedia Commons), redistribuées sous la même licence (voir CREDITS.md).\n"
          "const CORO_DATA = " + json.dumps(out, ensure_ascii=False) + ";\n")
    dst = os.path.join(HERE, "..", "js", "coro-data.js"); open(dst, "w").write(js)
    print("écrit", os.path.normpath(dst), f"{len(js) / 1024:.0f} Ko")
