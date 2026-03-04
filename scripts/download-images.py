#!/usr/bin/env python3
import os, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "products")
os.makedirs(OUT, exist_ok=True)

IMAGES = {
    1: ("CeraVe HA Serum", "https://m.media-amazon.com/images/I/61MHUk5-DQL._SL1500_.jpg"),
    2: ("Torriden DIVE-IN", "https://m.media-amazon.com/images/I/51AsSt2ALWL._SL1500_.jpg"),
    3: ("Anua Heartleaf", "https://m.media-amazon.com/images/I/51tLkM3PXKL._SL1500_.jpg"),
    4: ("COSRX Snail 96", "https://m.media-amazon.com/images/I/61bx5doUqZL._SL1500_.jpg"),
    5: ("The Ordinary HA", "https://m.media-amazon.com/images/I/61kQpsSBIqL._SL1500_.jpg"),
    6: ("Numbuzin No.3", "https://m.media-amazon.com/images/I/51kGE+R1GrL._SL1500_.jpg"),
    7: ("Innisfree Green Tea", "https://m.media-amazon.com/images/I/61K1VzDyJhL._SL1500_.jpg"),
    8: ("Paula's Choice HA", "https://m.media-amazon.com/images/I/61Qbj3rlC0L._SL1500_.jpg"),
}

print(f"Saving to: {OUT}\n")
for pid, (name, url) in IMAGES.items():
    out_path = os.path.join(OUT, f"product-{pid}.png")
    print(f"[{pid}] {name}...", end=" ")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=10).read()
        try:
            from PIL import Image
            from io import BytesIO
            img = Image.open(BytesIO(data))
            img.thumbnail((300, 400), Image.LANCZOS)
            canvas = Image.new("RGB", (300, 400), (248, 248, 248))
            canvas.paste(img, ((300-img.width)//2, (400-img.height)//2))
            canvas.save(out_path, "PNG")
        except ImportError:
            with open(out_path, "wb") as f:
                f.write(data)
        print(f"OK ({len(data)//1024}KB)")
    except Exception as e:
        print(f"FAIL ({e})")
print("\nDone!")
