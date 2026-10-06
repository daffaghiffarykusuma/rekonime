"""Rebuild the checked-in icon subset: python -m pip install 'fonttools[woff]'."""
from pathlib import Path
import re

from fontTools import subset
from fontTools.ttLib import TTFont

root = Path(__file__).resolve().parent.parent
source = root / "tools/fonts/phosphor-regular.woff2"
target = root / "public/fonts/phosphor-icons.woff2"
css = (root / "src/styles/phosphor-icons.css").read_text(encoding="utf-8")
codepoints = {int(value, 16) for value in re.findall(r'content:\s*"\\([0-9a-fA-F]+)"', css)}
if not codepoints:
    raise ValueError("No icon codepoints found in phosphor-icons.css")

font = TTFont(source, recalcTimestamp=False)
missing = codepoints - font.getBestCmap().keys()
if missing:
    raise ValueError(f"Source font is missing icon codepoints: {missing}")
options = subset.Options()
options.flavor = "woff2"
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=codepoints)
subsetter.subset(font)
font.save(target)
assert set(TTFont(target).getBestCmap()) == codepoints
print(f"Kept {len(codepoints)} icons: {source.stat().st_size} -> {target.stat().st_size} bytes")
