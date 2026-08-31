"""Regenerate favicon, PWA, and Android launcher icons from the PG skyline source."""

from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "app-icon-source.png"
NAVY = (0, 8, 28, 255)
PUBLIC = ROOT / "public"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"
LANCZOS = Image.Resampling.LANCZOS


def fill_black_corners(img: Image.Image, fill=NAVY) -> Image.Image:
    """Replace the baked black rounded-corner padding with navy."""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    seen = set()
    queue = deque([(0, 0), (width - 1, 0), (0, height - 1), (width - 1, height - 1)])

    def is_corner_black(pixel):
        return pixel[0] <= 12 and pixel[1] <= 12 and pixel[2] <= 16

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= width or y >= height:
            continue
        seen.add((x, y))
        if not is_corner_black(pixels[x, y]):
            continue
        pixels[x, y] = fill
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def resize_square(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), LANCZOS)


def padded(img: Image.Image, canvas_size: int, content_ratio: float) -> Image.Image:
    canvas = Image.new("RGBA", (canvas_size, canvas_size), NAVY)
    content = resize_square(img, max(1, round(canvas_size * content_ratio)))
    x = (canvas_size - content.width) // 2
    y = (canvas_size - content.height) // 2
    canvas.paste(content, (x, y), content)
    return canvas


def circular_crop(img: Image.Image) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGBA").save(path, format="PNG", optimize=True)


def save_ico(img: Image.Image, path: Path) -> None:
    sizes = [(16, 16), (32, 32), (48, 48)]
    img.convert("RGBA").save(path, format="ICO", sizes=sizes)


def save_favicon_svg(img: Image.Image, path: Path) -> None:
    import base64
    from io import BytesIO

    buf = BytesIO()
    resize_square(img, 256).save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">\n'
        f'  <image href="data:image/png;base64,{b64}" width="256" height="256"/>\n'
        "</svg>\n",
        encoding="utf-8",
    )


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source icon not found: {SOURCE}")

    square = fill_black_corners(Image.open(SOURCE))
    # Dual-purpose PWA icon: keep content inside the maskable safe zone.
    maskable = padded(square, 512, 0.8)

    save_png(resize_square(square, 16), PUBLIC / "favicon-16x16.png")
    save_png(resize_square(square, 32), PUBLIC / "favicon-32x32.png")
    save_png(resize_square(square, 96), PUBLIC / "favicon-96x96.png")
    save_png(resize_square(square, 180), PUBLIC / "apple-touch-icon.png")
    save_png(resize_square(maskable, 192), PUBLIC / "web-app-manifest-192x192.png")
    save_png(maskable, PUBLIC / "web-app-manifest-512x512.png")
    save_ico(square, PUBLIC / "favicon.ico")
    save_favicon_svg(square, PUBLIC / "favicon.svg")

    densities = {
        "mdpi": 1,
        "hdpi": 1.5,
        "xhdpi": 2,
        "xxhdpi": 3,
        "xxxhdpi": 4,
    }
    for name, scale in densities.items():
        folder = ANDROID_RES / f"mipmap-{name}"
        launcher = resize_square(square, int(48 * scale))
        save_png(launcher, folder / "ic_launcher.png")
        save_png(circular_crop(launcher), folder / "ic_launcher_round.png")
        # Adaptive foreground: 108dp canvas, content in the inner ~66% safe zone.
        save_png(padded(square, int(108 * scale), 0.66), folder / "ic_launcher_foreground.png")

    print("Wrote web and Android launcher icons from", SOURCE.name)


if __name__ == "__main__":
    main()
