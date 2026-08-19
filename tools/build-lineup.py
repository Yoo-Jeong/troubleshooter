# -*- coding: utf-8 -*-
"""
목록 페이지(characters.html) 상세 패널용 '키 비율 정규화' 이미지 생성.
- 각 캐릭터를 실제 키(cm)에 비례한 크기로 리사이즈
- 발을 공통 바닥선에 맞춤(모두 같은 땅에 서 있는 느낌)
- 원본 src/assets/img/lineup_raw/<k>.png 는 건드리지 않음(라인업 원본 보호)
- 결과: src/assets/img/lineup/<k>.png (모두 동일 캔버스 크기 → 패널에서 그대로 겹쳐도 비율/바닥 일치)
- ★프로젝트 루트에서 실행:  python tools/build-lineup.py

키(cm)는 각 캐릭터 front matter(roster.height)를 그대로 읽어온다 — 키를 바꾸고 싶으면
캐릭터 파일(src/characters/<슬러그>/index.html)의 roster.height를 고친 뒤 이 스크립트를 다시 실행.
"""
from PIL import Image
import os, json, re

# ── 정규화 규격 상수: src/assets/lineup-constants.json 한 곳에서 읽음 ──
#    프로필 작성 툴(profile-builder.html)도 같은 파일을 읽는다.
#    → 값을 바꾸려면 이 .py 가 아니라 그 JSON 을 고칠 것(한쪽만 바뀌어 어긋나는 일 방지).
_HERE  = os.path.dirname(os.path.abspath(__file__))                 # tools/
_CONST = os.path.join(_HERE, '..', 'src', 'assets', 'lineup-constants.json')
with open(_CONST, encoding='utf-8') as _fp:
    _C = json.load(_fp)

SRC = os.path.join(_HERE, '..', 'src', 'assets', 'img', 'lineup_raw')
OUT = os.path.join(_HERE, '..', 'src', 'assets', 'img', 'lineup')

# 키(cm)는 여기 따로 적지 않고 각 캐릭터 front matter(roster.height)에서 직접 읽는다.
# → 캐릭터 페이지에서 키를 바꿔도 이 스크립트가 자동으로 새 값을 따라가서,
#   여기 숫자를 깜빡 안 고쳐 라인업 이미지만 옛 키 기준으로 남는 일이 없다.
_CHARS_DIR = os.path.join(_HERE, '..', 'src', 'characters')
_SLUGS = ['seluka', 'vector', 's', 'meant', 'myt', 'merely']

def _read_height(slug):
    path = os.path.join(_CHARS_DIR, slug, 'index.html')
    with open(path, encoding='utf-8') as fp:
        text = fp.read()
    m = re.search(r'^roster:\s*\{[^}]*\bheight:\s*(\d+)', text, re.M)
    if not m:
        raise ValueError(f'{path} 의 front matter에서 roster.height 를 못 찾음')
    return int(m.group(1))

CM = {slug: _read_height(slug) for slug in _SLUGS}

# 일부 캐릭터는 원본(lineup_raw) 히어로 일러가 '서 있는' 포즈가 아니라 목록 정렬에 안 맞음.
# 그런 캐릭터만 '서 있는' 소스로 교체(키 비율 정렬용). 없으면 lineup_raw 기본 사용.
# S: 후드 히어로가 공중 점프 포즈 → 서 있는 정장 일러로 교체.
SRC_OVERRIDE = {
    's': os.path.join(_HERE, '..', '_local', 'source', '트슈 전신', '에스정장전신_투명화.png'),
}

OUT_H     = _C['OUT_H']      # 출력 캔버스 높이(px)
FLOOR_GAP = _C['FLOOR_GAP']  # 캔버스 바닥에서 발까지 여백(px) = 공통 바닥선
MAX_SIL   = _C['MAX_SIL']    # 가장 큰 키(TALLEST cm)일 때 실루엣 높이(px)
TALLEST   = _C['TALLEST']    # 기준 최대 키(cm) — 이보다 큰 캐릭터가 생기면 JSON에서 이 값을 올릴 것
CANVAS_W  = _C['CANVAS_W']   # 출력 캔버스 폭(px, 고정) — 모든 캐릭터가 같아야 겹쳤을 때 정렬됨

os.makedirs(OUT, exist_ok=True)

# 1차: 각 캐릭터를 키 비례로 스케일. maxw = 가장 넓은 폭(아래 잘림 경고용).
prepared = {}
maxw = 0
for k, cm in CM.items():
    f = SRC_OVERRIDE.get(k) or os.path.join(SRC, k + '.png')
    im = Image.open(f).convert('RGBA')
    bb = im.getbbox()                       # 실루엣(발~머리) 영역
    crop = im.crop(bb)
    bw, bh = crop.size
    sil_h = MAX_SIL * cm / TALLEST          # 실제 키 비례 실루엣 높이
    scale = sil_h / bh
    nw, nh = max(1, round(bw * scale)), max(1, round(bh * scale))
    crop = crop.resize((nw, nh), Image.LANCZOS)
    prepared[k] = crop
    maxw = max(maxw, nw)

# 캔버스 폭은 JSON 고정값. 어떤 캐릭터가 너무 넓어 양옆이 잘릴 것 같으면 미리 경고.
if maxw + 40 > CANVAS_W:
    print(f"⚠ 가장 넓은 캐릭터({maxw}px)에 비해 캔버스 폭 {CANVAS_W}px 가 좁음 → "
          f"lineup-constants.json 의 CANVAS_W 를 {maxw + 40} 이상으로 올리세요(안 그러면 양옆이 잘림).")

# 2차: 공통 캔버스에 발을 바닥선에 맞춰 가운데 배치
for k, crop in prepared.items():
    nw, nh = crop.size
    canvas = Image.new('RGBA', (CANVAS_W, OUT_H), (0, 0, 0, 0))
    x = (CANVAS_W - nw) // 2
    y = OUT_H - FLOOR_GAP - nh              # 발(하단)을 바닥선에 정렬
    canvas.alpha_composite(crop, (x, y))
    canvas.save(os.path.join(OUT, k + '.png'))
    print(f"{k:8s} {CM[k]}cm  sil_h={nh}px  head_y={y}px  -> {OUT}/{k}.png")

print(f"canvas = {CANVAS_W}x{OUT_H}, floor {FLOOR_GAP}px({FLOOR_GAP/OUT_H:.1%} from bottom)")
