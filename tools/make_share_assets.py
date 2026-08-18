"""Build original monochrome share + icon assets. No third-party art."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        "C:/Windows/Fonts/consolab.ttf" if bold else "C:/Windows/Fonts/consola.ttf",
        "C:/Windows/Fonts/CascadiaMono.ttf",
        "C:/Windows/Fonts/lucon.ttf",
        "C:/Windows/Fonts/courbd.ttf" if bold else "C:/Windows/Fonts/cour.ttf",
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def bracket_frame(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], arm: int = 28, w: int = 2) -> None:
    x0, y0, x1, y1 = box
    draw.rectangle(box, outline=(255, 255, 255), width=1)
    segs = (
        ((x0, y0), (x0 + arm, y0)),
        ((x0, y0), (x0, y0 + arm)),
        ((x1 - arm, y0), (x1, y0)),
        ((x1, y0), (x1, y0 + arm)),
        ((x0, y1), (x0 + arm, y1)),
        ((x0, y1 - arm), (x0, y1)),
        ((x1 - arm, y1), (x1, y1)),
        ((x1, y1 - arm), (x1, y1)),
    )
    for a, b in segs:
        draw.line((a, b), fill=(255, 255, 255), width=w)


def chevron(draw: ImageDraw.ImageDraw, cx: int, cy: int, s: int) -> None:
    pts = [
        (cx - int(s * 0.72), cy - int(s * 0.42)),
        (cx + int(s * 0.08), cy - int(s * 0.42)),
        (cx + int(s * 0.72), cy),
        (cx + int(s * 0.08), cy + int(s * 0.42)),
        (cx - int(s * 0.72), cy + int(s * 0.42)),
        (cx - int(s * 0.18), cy + int(s * 0.16)),
        (cx + int(s * 0.18), cy),
        (cx - int(s * 0.18), cy - int(s * 0.16)),
    ]
    draw.polygon(pts, fill=(255, 255, 255))
    streak_y = (cy - int(s * 0.28), cy - int(s * 0.06), cy + int(s * 0.16))
    for y in streak_y:
        draw.rectangle(
            (cx - int(s * 1.05), y, cx - int(s * 0.78), y + max(3, s // 16)),
            fill=(255, 255, 255),
        )


def make_og() -> None:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(0, h, 4):
        draw.line((0, y, w, y), fill=(12, 12, 12), width=1)
    bracket_frame(draw, (48, 40, w - 48, h - 40), arm=36, w=3)
    kicker = font(22)
    title = font(118, bold=True)
    sub = font(48, bold=True)
    tag = font(26)
    foot = font(20)
    draw.text((w / 2, 108), "HELIX ARC   ·   LOCKDOWN   ·   v2.0", font=kicker, fill=(180, 180, 180), anchor="mm")
    draw.text((w / 2, 250), "BASE", font=title, fill=(255, 255, 255), anchor="mm")
    draw.text((w / 2, 352), "BREAKER", font=sub, fill=(230, 230, 230), anchor="mm")
    draw.line((360, 412, 840, 412), fill=(255, 255, 255), width=1)
    draw.text((w / 2, 458), "JUMP   ·   ROLL   ·   FIRE", font=tag, fill=(220, 220, 220), anchor="mm")
    draw.text((w / 2, 548), "kxz0tn.github.io/basebreaker", font=foot, fill=(150, 150, 150), anchor="mm")
    img.save(ASSETS / "og.png", "PNG", optimize=True)


def make_icons() -> None:
    size = 512
    img = Image.new("RGB", (size, size), (0, 0, 0))
    draw = ImageDraw.Draw(img)
    for y in range(0, size, 4):
        draw.line((0, y, size, y), fill=(10, 10, 10), width=1)
    pad = 56
    bracket_frame(draw, (pad, pad, size - pad, size - pad), arm=48, w=6)
    chevron(draw, size // 2 + 8, size // 2, 150)
    img.resize((180, 180), Image.Resampling.LANCZOS).save(ASSETS / "apple-touch-icon.png", "PNG", optimize=True)
    img.resize((32, 32), Image.Resampling.LANCZOS).save(ASSETS / "favicon-32.png", "PNG", optimize=True)


if __name__ == "__main__":
    make_og()
    make_icons()
    print("wrote og.png apple-touch-icon.png favicon-32.png")
