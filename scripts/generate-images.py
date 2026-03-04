#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "products")
os.makedirs(OUT, exist_ok=True)

W, H = 300, 400
BG = (248, 248, 248)

PRODUCTS = [
    {"id": 1, "brand": "CeraVe",         "sub": "Hydrating HA Serum",        "vol": "30ml",  "body": (41, 98, 168),   "label": (255,255,255), "cap": (30, 70, 130),  "accent": (100, 170, 240)},
    {"id": 2, "brand": "Torriden",        "sub": "DIVE-IN HA Serum",          "vol": "50ml",  "body": (30, 130, 100),  "label": (255,255,255), "cap": (20, 90, 70),   "accent": (100, 210, 170)},
    {"id": 3, "brand": "Anua",            "sub": "Heartleaf 77% Toner",       "vol": "40ml",  "body": (200, 120, 50),  "label": (255,255,255), "cap": (160, 90, 30),  "accent": (240, 180, 100)},
    {"id": 4, "brand": "COSRX",           "sub": "Snail 96 Mucin",            "vol": "100ml", "body": (180, 60, 80),   "label": (255,255,255), "cap": (140, 40, 60),  "accent": (230, 130, 150)},
    {"id": 5, "brand": "The Ordinary",    "sub": "HA 2% + B5",                "vol": "30ml",  "body": (200, 190, 170), "label": (50, 50, 50),  "cap": (60, 60, 60),   "accent": (180, 170, 150)},
    {"id": 6, "brand": "Numbuzin",        "sub": "No.3 Softening Serum",      "vol": "50ml",  "body": (120, 70, 160),  "label": (255,255,255), "cap": (90, 50, 130),  "accent": (180, 130, 220)},
    {"id": 7, "brand": "innisfree",       "sub": "Green Tea HA Serum",        "vol": "80ml",  "body": (40, 140, 130),  "label": (255,255,255), "cap": (30, 100, 90),  "accent": (100, 200, 190)},
    {"id": 8, "brand": "Paula's Choice",  "sub": "BOOST HA Booster",          "vol": "15ml",  "body": (40, 50, 80),    "label": (255,255,255), "cap": (25, 35, 60),   "accent": (80, 100, 160)},
]

def draw_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill)
    draw.pieslice([x0, y0, x0+2*radius, y0+2*radius], 180, 270, fill=fill)
    draw.pieslice([x1-2*radius, y0, x1, y0+2*radius], 270, 360, fill=fill)
    draw.pieslice([x0, y1-2*radius, x0+2*radius, y1], 90, 180, fill=fill)
    draw.pieslice([x1-2*radius, y1-2*radius, x1, y1], 0, 90, fill=fill)

def lighter(color, factor=0.3):
    return tuple(min(255, int(c + (255 - c) * factor)) for c in color)

def darker(color, factor=0.3):
    return tuple(max(0, int(c * (1 - factor))) for c in color)

def generate_product(p):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.ellipse([95, 350, 205, 370], fill=(220, 220, 220))
    body_x0, body_x1 = 100, 200
    body_y0, body_y1 = 90, 350
    for i in range(body_x1 - body_x0):
        t = i / (body_x1 - body_x0)
        if t < 0.3:
            c = lighter(p["body"], 0.15 * (1 - t/0.3))
        elif t > 0.7:
            c = darker(p["body"], 0.1 * ((t-0.7)/0.3))
        else:
            c = p["body"]
        draw.line([(body_x0 + i, body_y0 + 10), (body_x0 + i, body_y1 - 5)], fill=c)
    draw.pieslice([body_x0, body_y0, body_x1, body_y0 + 20], 180, 360, fill=p["body"])
    draw.pieslice([body_x0, body_y1 - 15, body_x1, body_y1], 0, 180, fill=darker(p["body"], 0.1))
    neck_w = 20
    neck_x0 = W//2 - neck_w//2
    draw.rectangle([neck_x0, 55, neck_x0 + neck_w, body_y0 + 10], fill=p["body"])
    cap_w = 30
    cap_x0 = W//2 - cap_w//2
    draw_rounded_rect(draw, [cap_x0, 25, cap_x0 + cap_w, 60], 6, p["cap"])
    draw.polygon([(W//2-3, 60), (W//2+3, 60), (W//2, 72)], fill=p["cap"])
    label_margin = 15
    label_y0 = 140
    label_y1 = 300
    draw_rounded_rect(draw, [body_x0 + label_margin, label_y0, body_x1 - label_margin, label_y1], 8, p["label"])
    draw.rectangle([body_x0 + label_margin, label_y0, body_x1 - label_margin, label_y0 + 4], fill=p["accent"])
    try:
        font_brand = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
        font_sub = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 10)
        font_vol = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 9)
    except:
        try:
            font_brand = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 16)
            font_sub = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 10)
            font_vol = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 9)
        except:
            font_brand = ImageFont.load_default()
            font_sub = font_brand
            font_vol = font_brand
    text_color = (50, 50, 50) if p["label"] == (255,255,255) else (255, 255, 255)
    cx = W // 2
    bb = draw.textbbox((0, 0), p["brand"], font=font_brand)
    bw = bb[2] - bb[0]
    draw.text((cx - bw//2, label_y0 + 15), p["brand"], fill=text_color, font=font_brand)
    div_y = label_y0 + 40
    draw.line([(body_x0 + label_margin + 15, div_y), (body_x1 - label_margin - 15, div_y)], fill=text_color, width=1)
    words = p["sub"].split()
    lines = []
    current = ""
    for w in words:
        test = (current + " " + w).strip()
        tb = draw.textbbox((0,0), test, font=font_sub)
        if tb[2] - tb[0] > 65:
            if current: lines.append(current)
            current = w
        else:
            current = test
    if current: lines.append(current)
    for li, line in enumerate(lines):
        tb = draw.textbbox((0,0), line, font=font_sub)
        tw = tb[2] - tb[0]
        draw.text((cx - tw//2, div_y + 10 + li * 14), line, fill=text_color, font=font_sub)
    vb = draw.textbbox((0,0), p["vol"], font=font_vol)
    vw = vb[2] - vb[0]
    draw.text((cx - vw//2, label_y1 - 22), p["vol"], fill=text_color, font=font_vol)
    for dx in [-12, 0, 12]:
        draw.ellipse([cx + dx - 2, label_y1 - 35, cx + dx + 2, label_y1 - 31], fill=p["accent"])
    out_path = os.path.join(OUT, f"product-{p['id']}.png")
    img.save(out_path, "PNG", optimize=True)
    size_kb = os.path.getsize(out_path) / 1024
    print(f"  [{p['id']}] {p['brand']:15s} ({size_kb:.1f}KB)")

print(f"Generating {len(PRODUCTS)} product images\n")
for p in PRODUCTS:
    generate_product(p)
print("\nDone!")
