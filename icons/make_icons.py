from PIL import Image, ImageDraw

def make_icon(size, path, maskable=False):
    pad = int(size * 0.12) if maskable else 0
    img = Image.new("RGB", (size, size), "#0f172a")
    d = ImageDraw.Draw(img)
    s = size - pad * 2
    x0, y0 = pad, pad
    x1, y1 = pad + s, pad + s
    d.rounded_rectangle([x0, y0, x1, y1], radius=int(s * 0.25), fill="#10b981")
    cx, cy = size / 2, size / 2
    r = s * 0.22
    d.ellipse([cx - r, cy - r - s * 0.06, cx + r, cy + r - s * 0.06], fill="white")
    d.polygon([(cx - r * 1.5, cy + s * 0.28), (cx - r * 0.6, cy - s * 0.02), (cx + r * 0.6, cy - s * 0.02), (cx + r * 1.5, cy + s * 0.28)], fill="white")
    img.save(path)
    print("OK", path)

make_icon(192, "icons/icon-192.png")
make_icon(512, "icons/icon-512.png")
make_icon(512, "icons/icon-maskable-512.png", maskable=True)
