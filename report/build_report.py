#!/usr/bin/env python3
"""Builds report/report.pdf  (needs:  pip install reportlab).
Screenshots in report/screens/*.png are used when present, placeholders otherwise.
Everything numeric in the report (matrices, hand check, depth precision) is computed here,
independently of the JavaScript, and asserted against the values the app produced."""
import math, os, json
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                Preformatted, Flowable, KeepTogether)
from reportlab.graphics.shapes import Drawing, Line, Rect, String, PolyLine, Circle

HERE = os.path.dirname(os.path.abspath(__file__))
F = lambda n: os.path.join(HERE, 'fonts', n)
pdfmetrics.registerFont(TTFont('DV', F('DejaVuSans.ttf')))
pdfmetrics.registerFont(TTFont('DV-B', F('DejaVuSans-Bold.ttf')))
pdfmetrics.registerFont(TTFont('DV-I', F('DejaVuSans-Oblique.ttf')))
pdfmetrics.registerFont(TTFont('DVM', F('DejaVuSansMono.ttf')))
pdfmetrics.registerFontFamily('DV', normal='DV', bold='DV-B', italic='DV-I', boldItalic='DV-B')

INK = colors.HexColor('#1d1b18'); ACC = colors.HexColor('#1f5f8b'); RED = '#c00000'
body = ParagraphStyle('body', fontName='DV', fontSize=8.4, leading=10.9, textColor=INK, alignment=TA_LEFT, spaceAfter=3)
h1 = ParagraphStyle('h1', parent=body, fontName='DV-B', fontSize=11, leading=13.5, textColor=ACC, spaceBefore=5, spaceAfter=3)
h0 = ParagraphStyle('h0', parent=body, fontName='DV-B', fontSize=15, leading=18, spaceAfter=2)
cap = ParagraphStyle('cap', parent=body, fontSize=7.2, leading=9, textColor=colors.HexColor('#55504a'), spaceAfter=2)
mono = ParagraphStyle('mono', fontName='DVM', fontSize=6.9, leading=8.4, textColor=INK)
small = ParagraphStyle('small', parent=body, fontSize=7.6, leading=9.6)
TODO = lambda s: f'<font color="{RED}"><b>[TODO: {s}]</b></font>'
P = lambda s, st=body: Paragraph(s, st)

def mul(a, b):
    return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def I(): return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
def T(x,y,z): m=I(); m[12],m[13],m[14]=x,y,z; return m
def S(x,y,z): m=I(); m[0],m[5],m[10]=x,y,z; return m
def Ry(t): m=I(); c,s=math.cos(t),math.sin(t); m[0],m[2],m[8],m[10]=c,-s,s,c; return m
def Rz(t): m=I(); c,s=math.cos(t),math.sin(t); m[0],m[1],m[4],m[5]=c,s,-s,c; return m
def fmt(m, d=2):
    w = d + 4
    return '\n'.join(''.join(f'{(0.0 if abs(m[c*4+r]) < 0.5*10**-d else m[c*4+r]):{w}.{d}f}' for c in range(4)) for r in range(4))

TRS = mul(T(0,-0.15,0.7), mul(Ry(0.6), S(0.4,0.4,0.4)))
SRT = mul(S(0.4,0.4,0.4), mul(Ry(0.6), T(0,-0.15,0.7)))
APP_TRS = [0.33013424277305603,0,-0.22585700452327728,0,0,0.4,0,0,0.22585700452327728,0,0.33013424277305603,0,0,-0.15,0.7,1]
APP_SRT = [0.33013424277305603,0,-0.22585700452327728,0,0,0.4,0,0,0.22585700452327728,0,0.33013424277305603,0,0.15809988975524902,-0.06,0.23109398782253265,1]
assert max(abs(x-y) for x,y in zip(TRS,APP_TRS)) < 1e-6 and max(abs(x-y) for x,y in zip(SRT,APP_SRT)) < 1e-6

a = 1280/893
th = 0.9*math.sin(1.0); phi = 0.45
B_ = T(0.65*a,-0.85,0.5); SH = mul(T(0,0.12,0), Rz(0.5*math.sin(0)))
EL = mul(T(0,0.55,0), Rz(th)); WR = mul(T(0,0.45,0), Ry(0)); FL = mul(T(-0.06,0.08,0), Rz(phi))
WORLD = mul(B_, mul(SH, mul(EL, mul(WR, FL))))
APP_FINGER = [0.3555220067501068,0.9346679449081421,0,0,-0.9346679449081421,0.3555220067501068,0,0,0,0,1,0,0.5239913463592529,0.1639200747013092,0.5,1]
assert max(abs(x-y) for x,y in zip(WORLD,APP_FINGER)) < 1e-5
hx = 0.65*a - (0.45+0.08)*math.sin(th) - 0.06*math.cos(th)
hy = -0.85+0.12+0.55 + (0.45+0.08)*math.cos(th) - 0.06*math.sin(th)
assert abs(hx-WORLD[12]) < 1e-9 and abs(hy-WORLD[13]) < 1e-9

step = 2**-24
dz = lambda n,f,z: step / (f*n/(z*z*(f-n)))

class Shot(Flowable):
    """Screenshot slot: report/screens/<name>.png if it exists, else a labelled placeholder."""
    def __init__(self, name, label, w, h):
        super().__init__(); self.name, self.label, self.w, self.h = name, label, w, h
        self.path = os.path.join(HERE, 'screens', name + '.png')
    def wrap(self, aw, ah): return self.w, self.h
    def draw(self):
        c = self.canv
        if os.path.exists(self.path):
            from reportlab.lib.utils import ImageReader
            ir = ImageReader(self.path); iw, ih = ir.getSize(); s = min(self.w/iw, self.h/ih)
            c.drawImage(ir, (self.w-iw*s)/2, (self.h-ih*s)/2, iw*s, ih*s)
            c.setStrokeColor(colors.HexColor('#bbbbbb')); c.rect(0, 0, self.w, self.h)
        else:
            c.setStrokeColor(colors.HexColor(RED)); c.setDash(3, 3); c.rect(0, 0, self.w, self.h); c.setDash()
            c.setFillColor(colors.HexColor(RED)); c.setFont('DV-B', 7.5)
            c.drawCentredString(self.w/2, self.h/2+6, 'SCREENSHOT NEEDED')
            c.setFont('DV', 6.6); c.drawCentredString(self.w/2, self.h/2-4, f'screens/{self.name}.png')
            c.setFillColor(colors.HexColor('#55504a')); c.drawCentredString(self.w/2, self.h/2-14, self.label)

def shot_cell(name, label, w, h, caption):
    return [Shot(name, label, w, h), Spacer(1, 1.5), P(caption, cap)]

def tree_drawing(w=7.6*cm, h=5.3*cm):
    d = Drawing(w, h)
    nodes = {
        'base': (0.2, 4.6, 0), 'shoulder': (0.7, 3.6, 1), 'elbow': (1.2, 2.6, 2), 'wrist': (1.7, 1.6, 3),
        'fingerL': (1.0, 0.45, 4), 'fingerR': (3.6, 0.45, 4)}
    edges = [('base','shoulder'),('shoulder','elbow'),('elbow','wrist'),('wrist','fingerL'),('wrist','fingerR')]
    bw, bh = 1.9*cm, 0.62*cm
    pos = {k: (v[0]*cm, v[1]*cm) for k, v in nodes.items()}
    for p, c in edges:
        (x1,y1),(x2,y2) = pos[p], pos[c]
        d.add(Line(x1+bw/2, y1, x2+bw/2, y2+bh, strokeColor=colors.HexColor('#888888'), strokeWidth=1))
    for k, (x, y) in pos.items():
        d.add(Rect(x, y, bw, bh, rx=3, ry=3, fillColor=colors.HexColor('#eaf2f8'), strokeColor=ACC, strokeWidth=0.9))
        d.add(String(x+bw/2, y+bh/2-2.5, k, fontName='DV-B', fontSize=7.6, textAnchor='middle', fillColor=INK))
        d.add(String(x+bw+4, y+bh/2-2.5, f'level {nodes[k][2]}', fontName='DV', fontSize=6.4, fillColor=colors.HexColor('#55504a')))
    return d

def bernstein_drawing(w=6.4*cm, h=4.0*cm):
    d = Drawing(w, h); ox, oy, W, H = 0.9*cm, 0.6*cm, w-1.4*cm, h-1.1*cm
    d.add(Line(ox, oy, ox+W, oy)); d.add(Line(ox, oy, ox, oy+H))
    for t in (0, 0.5, 1): d.add(String(ox+t*W, oy-9, f'{t:g}', fontName='DV', fontSize=6, textAnchor='middle'))
    for v in (0, 0.5, 1): d.add(String(ox-3, oy+v*H-2, f'{v:g}', fontName='DV', fontSize=6, textAnchor='end'))
    d.add(String(ox+W/2, oy-18, 't', fontName='DV-I', fontSize=7, textAnchor='middle'))
    cols = ['#b4441c', '#1f5f8b', '#3c7a3a', '#8a5aa8']
    fns = [lambda t:(1-t)**3, lambda t:3*t*(1-t)**2, lambda t:3*t*t*(1-t), lambda t:t**3]
    for i, (f, c) in enumerate(zip(fns, cols)):
        pts = []
        for k in range(41): t = k/40; pts += [ox+t*W, oy+f(t)*H]
        d.add(PolyLine(pts, strokeColor=colors.HexColor(c), strokeWidth=1.3))
        d.add(String(ox+W+3, oy+H-9-i*9, f'B{i}', fontName='DV-B', fontSize=6.6, fillColor=colors.HexColor(c)))
    return d

def mat_table(items, widths):
    cells = [[Preformatted(t, mono) for _, t in items]]
    heads = [[P(f'<b>{h}</b>', small) for h, _ in items]]
    t = Table(heads + cells, colWidths=widths)
    t.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOX', (0,1), (-1,1), 0.4, colors.HexColor('#bbbbbb')),
                           ('LEFTPADDING', (0,0), (-1,-1), 3), ('RIGHTPADDING', (0,0), (-1,-1), 3),
                           ('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1)]))
    return t

def side_by_side(cols, widths, valign='TOP'):
    t = Table([cols], colWidths=widths)
    t.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), valign), ('LEFTPADDING', (0,0), (-1,-1), 0),
                           ('RIGHTPADDING', (0,0), (-1,-1), 4), ('TOPPADDING', (0,0), (-1,-1), 0), ('BOTTOMPADDING', (0,0), (-1,-1), 0)]))
    return t

W_ = A4[0] - 3.0*cm
story = []
story += [P('CS405 Introduction to Computer Graphics · Fall 2026 — Project 1 report', h0),
          P(f'Transformations, Projection &amp; Curves from Paintings &nbsp;·&nbsp; Name / ID: {TODO("your name and student ID")}', small)]

story += [P('Painting', h1),
          P('<b>Şeker Ahmed Paşa — <i>Kavunlu Natürmort</i></b> (Sakıp Sabancı Museum collection). I chose it for its '
            'organic contours: the long upper outline of the whole melon and the lower rim of the cut slice are smooth, '
            'closed-looking shapes that a few cubic segments can follow, which suits Part D. The dark, nearly flat '
            'background also makes the painting quad read clearly behind coloured 3D objects. Everything below uses one '
            'application (WebGPU + WGSL, own maths library, no external libraries); <font name="DVM">npm test</font> runs 55 unit '
            'tests (1 skipped: B-spline, because I implemented Catmull–Rom as the second curve family).')]

story += [P('Part A — Transformations', h1)]
story += [P('Matrices are column-major <font name="DVM">Float32Array(16)</font> (translation at indices 12–14), column vectors, '
            '<font name="DVM">multiply(A,B)=A·B</font> so B acts first. For the UI cube (rotation 0.6 rad about y, scale 0.4, translation '
            '(0, −0.15, 0.7)) the two orders give:')]
story += [mat_table([('M = T·R·S   (scale, rotate, then translate)', fmt(TRS)), ('M = S·R·T   (translate, rotate, then scale)', fmt(SRT))],
                    [W_/2, W_/2])]
story += [Spacer(1, 3),
          P('<b>Why they differ.</b> With <i>M</i> = T·R·S the cube is scaled and rotated about <i>its own</i> origin and only then moved, '
            'so the translation column is exactly (0, −0.15, 0.7). With <i>M</i> = S·R·T the translation is applied first and the '
            'rotation and scale then act on that <i>offset</i> too: the translation column becomes S·R·t = (0.158, −0.060, 0.231), '
            'so the cube swings around the world origin and shrinks towards it. (With the uniform scale used here the upper-left 3×3 blocks '
            'coincide; with a non-uniform scale S·R ≠ R·S and the block differs as well, giving a skewed cube.) '
            '<b>Convention used everywhere else: M = T·R·S.</b> It matches how an object is described (its size, its orientation, then its '
            'place) and it is what the scene graph needs: <font name="DVM">world = parent.world · local</font> with local = T·R, '
            'so a child is expressed in its parent’s frame.')]
story += [side_by_side([shot_cell('a_trs', 'order = T·R·S, matrices visible', 8.7*cm, 5.3*cm, 'Fig. 1 — T·R·S (panel shows both matrices).'),
                        shot_cell('a_srt', 'order = S·R·T, same parameters', 8.7*cm, 5.3*cm, 'Fig. 2 — S·R·T with identical sliders.')],
                       [W_/2, W_/2])]

story += [P('Part B — Scene graph', h1)]
rows = [['node', 'local transform (animated parts in <i>italics</i>)'],
        ['base', 'T(0.65a, −0.85, 0.5),  a = image width / height'],
        ['shoulder', 'T(0, 0.12, 0) · <i>R<sub>z</sub>(0.5 sin t)</i>'],
        ['elbow', 'T(0, 0.55, 0) · <i>R<sub>z</sub>(0.9 sin(1.3t+1))</i>'],
        ['wrist', 'T(0, 0.45, 0) · <i>R<sub>y</sub>(1.5t)</i>'],
        ['fingerL / R', 'T(∓0.06, 0.08, 0) · <i>R<sub>z</sub>(±(0.45+0.3 sin 3t))</i>']]
tb = Table([[P(c, small) for c in r] for r in rows], colWidths=[1.9*cm, 6.6*cm])
tb.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#bbbbbb')), ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#eaf2f8')),
                        ('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1)]))
story += [side_by_side([[tree_drawing(), P('Fig. 3 — Scene-graph tree: 6 nodes, 5 levels. Each node stores a local matrix; '
                                          '<font name="DVM">updateWorld()</font> sets <font name="DVM">world = parent.world · local</font> depth-first. '
                                          'Meshes are boxes in node space, so scaling them never changes what children inherit.', cap)],
                        [tb]], [8.4*cm, W_-8.4*cm])]
hand = [Spacer(1, 3), P('<b>World matrix of the leaf <font name="DVM">fingerL</font>, verified by hand</b> (animation frozen at t = 0: '
        f'shoulder angle 0, elbow θ = 0.9 sin 1 = {th:.4f}, wrist angle 0, finger opening φ = 0.45). '
        'world = base · shoulder · elbow · wrist · fingerL. The rotations all about z add up, R<sub>z</sub>(θ)·R<sub>z</sub>(φ) = R<sub>z</sub>(θ+φ) = '
        f'R<sub>z</sub>({th+phi:.4f}), with cos = {math.cos(th+phi):.4f}, sin = {math.sin(th+phi):.4f}. The translation is the sum of the offsets, '
        'each rotated by the rotations above it (only the elbow rotates the wrist and finger offsets):')]
hand += [Preformatted(
    f'x = 0.65a − (0.45 + 0.08)·sin θ − 0.06·cos θ = {0.65*a:.4f} − 0.53·{math.sin(th):.4f} − 0.06·{math.cos(th):.4f} = {hx:.4f}\n'
    f'y = (−0.85 + 0.12 + 0.55) + (0.45 + 0.08)·cos θ − 0.06·sin θ = −0.18 + 0.53·{math.cos(th):.4f} − 0.06·{math.sin(th):.4f} = {hy:.4f}\n'
    f'z = 0.5', mono)]
hand += [Spacer(1, 2), side_by_side([[Preformatted(fmt(WORLD, 3), mono)],
                                      [P('The matrix at left is what the app prints for <font name="DVM">world(fingerL)</font> at t = 0 '
                                         '(Part B panel, “animate” unticked). It agrees with the hand calculation above (translation '
                                         f'({hx:.3f}, {hy:.3f}, 0.5), rotation R<sub>z</sub>({th+phi:.3f})); this agreement is also asserted by the '
                                         'script that generated this report, using an independent Python implementation.', small)]],
                                     [8.3*cm, W_-8.3*cm])]
story += [KeepTogether(hand)]

story += [P('Part C — Camera and projection', h1)]
story += [P('<b>View matrix.</b> With eye <b>e</b>, target <b>t</b> and up <b>u</b><sub>0</sub>: forward <b>f</b> = (<b>t</b>−<b>e</b>)/|<b>t</b>−<b>e</b>|; '
            'right <b>s</b> = <b>f</b>×<b>u</b><sub>0</sub> / |·| (cross product 1); true up <b>u</b> = <b>s</b>×<b>f</b> (cross product 2). The camera looks down −z, so its axes '
            'in world space are <b>s</b>, <b>u</b>, −<b>f</b>. <i>V</i> must map the camera frame onto the coordinate axes and the eye to the origin: '
            '<i>V</i> = R·T(−<b>e</b>) with the orthonormal rows of R equal to <b>s</b>, <b>u</b>, −<b>f</b> (R<sup>−1</sup> = R<sup>T</sup>), i.e.')]
story += [Preformatted('        [  s_x   s_y   s_z   −s·e ]\n   V =  [  u_x   u_y   u_z   −u·e ]        (last row: 0 0 0 1)\n        [ −f_x  −f_y  −f_z   +f·e ]', mono),
          P('Degenerate case: if |<b>f</b>×<b>u</b><sub>0</sub>| &lt; 10<super>−6</super> (looking straight along up) the up vector is replaced by world z '
            '(or x when <b>f</b> is nearly along z), so the matrix stays finite and orthonormal — tested for top-down and bottom-up views.')]
story += [P('<b>Projection (depth in [0, 1]).</b> With n, f the near/far distances and F = 1/tan(fovY/2): x<sub>clip</sub> = (F/aspect)·x, y<sub>clip</sub> = F·y, '
            'w<sub>clip</sub> = −z, z<sub>clip</sub> = A·z + B. Requiring z<sub>ndc</sub> = z<sub>clip</sub>/w<sub>clip</sub> = 0 at z = −n and 1 at z = −f gives '
            'B = A·n and (−A·f + A·n)/f = 1, so <b>A = f/(n−f)</b>, <b>B = nf/(n−f)</b> (OpenGL would give [−1, 1] and a different A, B). '
            'The orthographic matrix has z<sub>clip</sub> = z/(n−f) + n/(n−f), x, y scaled by 2/(r−l), 2/(t−b), and w = 1, with the same depth mapping.')]
story += [side_by_side([shot_cell('c_persp', 'same scene, perspective', 5.7*cm, 3.9*cm, 'Fig. 4 — perspective.'),
                        shot_cell('c_ortho', 'same scene, orthographic', 5.7*cm, 3.9*cm, 'Fig. 5 — orthographic.'),
                        shot_cell('c_frustum', 'split view with frustum', 5.7*cm, 3.9*cm, 'Fig. 6 — inspection view with the main camera’s frustum (cyan = near, yellow = far).')],
                       [W_/3]*3)]
story += [P('<b>Near/far discussion.</b> I use near = 0.1 and far = 100 (the sliders change both live). The depth derivative is '
            'dz<sub>ndc</sub>/dz<sub>view</sub> = nf / (z²(f−n)) ≈ n/z², so precision is governed by <i>near</i>, hardly by far. Assuming a 24-bit depth buffer '
            f'(<font name="DVM">depth24plus</font>) the smallest resolvable depth step is {dz(0.1,100,2.8):.1e} units at z = 2.8 (default camera distance) and '
            f'{dz(0.1,100,9.0):.1e} at z = 9 (inspection camera); cutting far to 10 changes it only to {dz(0.1,10,2.8):.1e}. Moving near to 0.01 costs a factor 10 '
            f'({dz(0.01,100,2.8):.1e} at z = 2.8). The smallest real gap in the scene is the 0.012 lift of the curves above the painting, '
            f'about {0.012/dz(0.1,100,2.8):,.0f}× the step at z = 2.8 and {0.012/dz(0.1,100,9.0):.0f}× at z = 9, so there is no z-fighting. '
            f'Orthographic depth is linear, step (f−n)/2<super>24</super> = {(100-0.1)*step:.1e}. The frustum is drawn with its far plane clamped to min(far, 1.7·distance), '
            'otherwise a far plane at 100 would dwarf the scene.')]

story += [P('Part D — Curves over the painting', h1)]
story += [side_by_side([[bernstein_drawing(), P('Fig. 7 — cubic Bernstein basis.', cap)],
        [P('<b>Bézier basis.</b> P(t) = Σ B<sub>i</sub>(t) P<sub>i</sub>, t ∈ [0,1], with B<sub>0</sub> = (1−t)³, B<sub>1</sub> = 3t(1−t)², '
           'B<sub>2</sub> = 3t²(1−t), B<sub>3</sub> = t³; they are ≥ 0 and sum to (t + (1−t))³ = 1. '
           '<b>Endpoints.</b> B(0) = (1,0,0,0) and B(1) = (0,0,0,1), hence P(0) = P<sub>0</sub> and P(1) = P<sub>3</sub>. '
           'The derivative is P′(t) = 3[(1−t)²(P<sub>1</sub>−P<sub>0</sub>) + 2t(1−t)(P<sub>2</sub>−P<sub>1</sub>) + t²(P<sub>3</sub>−P<sub>2</sub>)], so '
           'P′(0) = 3(P<sub>1</sub>−P<sub>0</sub>) and P′(1) = 3(P<sub>3</sub>−P<sub>2</sub>). '
           '<b>de Casteljau.</b> Each level is made from the previous one by linear interpolation of neighbours, q<sub>j</sub> = (1−t)·p<sub>j</sub> + t·p<sub>j+1</sub>; starting from 4 points, three rounds (4→3→2→1 points) leave the single point P(t). '
           'The app draws levels 1 (blue) and 2 (green) and the result (red) for a chosen segment and t.', body)]],
        [6.7*cm, W_-6.7*cm])]
story += [P('<b>C¹ at a joint.</b> For consecutive segments (P<sub>0</sub>,…,P<sub>3</sub>) and (Q<sub>0</sub>,…,Q<sub>3</sub>): C⁰ needs Q<sub>0</sub> = P<sub>3</sub>; equal first derivatives need '
            '3(P<sub>3</sub>−P<sub>2</sub>) = 3(Q<sub>1</sub>−Q<sub>0</sub>), i.e. <b>Q<sub>1</sub> = 2P<sub>3</sub> − P<sub>2</sub></b> (handles collinear and of equal length). '
            'With the global parameter u = (i+t)/n both sides are scaled by the same n, so the condition is unchanged. The editor re-applies it after every drag '
            '(<font name="DVM">enforceC1</font>), and a unit test checks position and tangent at all joints after 200 random drags. '
            '<b>Catmull–Rom</b> (second family): P(t) = ½[2P<sub>1</sub> + (P<sub>2</sub>−P<sub>0</sub>)t + (2P<sub>0</sub>−5P<sub>1</sub>+4P<sub>2</sub>−P<sub>3</sub>)t² + (−P<sub>0</sub>+3P<sub>1</sub>−3P<sub>2</sub>+P<sub>3</sub>)t³]; '
            'P(0) = P<sub>1</sub>, P(1) = ½(2P<sub>2</sub>) = P<sub>2</sub> (the P<sub>0</sub>, P<sub>1</sub>, P<sub>3</sub> coefficients cancel), P′(0) = ½(P<sub>2</sub>−P<sub>0</sub>), so it passes through every control point.')]
story += [P('<b>Interaction and animation.</b> Control points are picked by projecting them with P·V (18 px radius) and dragged on the painting plane z = 0: the pointer ray is built in view '
            'space and moved to world space with the rigid inverse of V, then intersected with z = 0. Shift+click appends a segment/point. An arrow rides the active curve; its heading is atan2(T<sub>y</sub>, T<sub>x</sub>) '
            'of the tangent and its matrix is T(p)·R<sub>z</sub>(heading)·S. Points are stored as normalised (u, v) with u = (x+a)/(2a), v = (1−y)/2, so export needs no conversion.')]
bez = {"painting":"kavunlu","kind":"bezier-c1","segments":[[[0.30078,0.24076],[0.33594,0.13998],[0.42188,0.10974],[0.53125,0.10974]],[[0.53125,0.10974],[0.64063,0.10974],[0.83984,0.26316],[0.86875,0.33595]],[[0.86875,0.33595],[0.89766,0.40873],[0.89063,0.50392],[0.86328,0.57671]]]}
crv = {"painting":"kavunlu","kind":"catmull-rom","points":[[0.18359,0.6383],[0.23438,0.72788],[0.35156,0.79507],[0.5,0.82307],[0.66406,0.78947],[0.78125,0.72228],[0.82031,0.67413]]}
j1 = '{"painting": "kavunlu", "kind": "bezier-c1", "segments": [\n' + ',\n'.join('  ' + json.dumps(s, separators=(',', ':')) for s in bez['segments']) + '\n]}'
pts = crv['points']
j2 = '{"painting": "kavunlu", "kind": "catmull-rom", "points": [\n  ' + ',\n  '.join(json.dumps(p, separators=(',', ':')) for p in pts) + '\n]}'
story += [side_by_side([shot_cell('d_curve', 'traced melon outline + control polygon', 8.2*cm, 5.6*cm,
                                  'Fig. 8 — Bézier (3 segments, C¹) tracing the upper outline of the melon; orange = anchors, white = handles.'),
                        [P('<b>Appendix — exported JSON</b> (normalised coordinates, origin top-left, v down; files in <font name="DVM">exports/</font>)', small),
                         Preformatted(j1, ParagraphStyle('m2', parent=mono, fontSize=5.7, leading=7)), Spacer(1, 2),
                         Preformatted(j2, ParagraphStyle('m3', parent=mono, fontSize=5.7, leading=7))]],
                       [8.4*cm, W_-8.4*cm])]

story += [P('What went wrong, and how I found it', h1)]
story += [P('<b>1. Test suite misread my choice of second curve.</b> After deleting the unused B-spline functions, one starter test failed with “<font name="DVM">c.bsplineBasis is not a function</font>”. '
            'The tests detect an unimplemented function by catching the starter’s <font name="DVM">NotImplemented</font> error, so a missing export looks like an implemented-but-broken one. '
            'I restored the two stubs (<font name="DVM">todo()</font>) and the test is skipped as intended. '
            '<b>2. Avoided: shared uniform buffers.</b> The starter README warns that all <font name="DVM">writeBuffer</font> calls run before the frame’s commands, so two draws sharing one buffer both see the last value. '
            'This matters twice here: the painting is drawn in two views per frame (it now owns one uniform buffer per view), and every cube / line draw takes its own slot from a pool. '
            '<b>3. Avoided: z-fighting.</b> Drawn at z = 0 the curves would z-fight with the painting; I lifted them 0.012 and checked with the depth-step numbers above that this is safe. '
            '<b>4. No GPU in my build environment.</b> The code was developed without a WebGPU device, so I verified what I could without one: unit tests, a mock-driven check of picking/ray/C¹ logic, a WGSL parse of all shaders, and an independent '
            'recomputation of the matrices in this report. ' + TODO('add anything you actually hit while running it in your browser, and how you found it') + ' '
            '<i>AI assistance (Claude) was used for code and text, as the handout allows; I ran and checked the result myself.</i> ' + TODO('confirm this statement is true for you, or delete it'))]

story += [P('Measured frame times', h1)]
hdr = ['view', 'frame ms (fps)', 'cpu ms', 'draws', 'vertices / frame']
mrows = [hdr,
         ['main camera', TODO('ms'), TODO('ms'), '29 expected', '2 310 expected'],
         ['inspection only', TODO('ms'), TODO('ms'), '30 expected', '2 348 expected'],
         ['split (main | inspection)', TODO('ms'), TODO('ms'), '59 expected', '4 658 expected']]
mt = Table([[P(c, small) for c in r] for r in mrows], colWidths=[4.0*cm, 3.6*cm, 2.2*cm, 2.8*cm, W_-12.6*cm])
mt.setStyle(TableStyle([('GRID', (0,0), (-1,-1), 0.3, colors.HexColor('#bbbbbb')), ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#eaf2f8')),
                        ('TOPPADDING', (0,0), (-1,-1), 1), ('BOTTOMPADDING', (0,0), (-1,-1), 1)]))
story += [mt, Spacer(1, 2),
          P(f'GPU / browser / OS / resolution: {TODO("e.g. GPU model, Chrome version, 1920×1080")}. Frame time is capped by the display refresh (16.7 ms at 60 Hz), so cpu ms is the more informative figure. '
            '“Expected” counts are computed from the draw list with debug drawings off and the default curves (27 cubes × 36 + painting 6 + 1 332 line vertices = 2 310; draws = painting + 27 cubes + 1 line batch + 1 more line batch for the frustum in the inspection view, which adds 38 line vertices); '
            'replace them with what the panel shows if they differ.', small)]

def footer(c, doc):
    c.saveState(); c.setFont('DV', 7); c.setFillColor(colors.HexColor('#55504a'))
    c.drawString(1.5*cm, 0.9*cm, 'CS405 · Project 1 · Kavunlu Natürmort'); c.drawRightString(A4[0]-1.5*cm, 0.9*cm, f'page {doc.page}')
    c.restoreState()

out = os.path.join(HERE, 'report.pdf')
doc = BaseDocTemplate(out, pagesize=A4, leftMargin=1.5*cm, rightMargin=1.5*cm, topMargin=1.3*cm, bottomMargin=1.5*cm,
                      title='CS405 Project 1 report', author='')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(1.5*cm, 1.5*cm, W_, A4[1]-2.8*cm, id='f', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=footer)])
doc.build(story)
print('wrote', out)
