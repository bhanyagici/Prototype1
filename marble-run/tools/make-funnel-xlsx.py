# Builds dist/funnel.xlsx from the funnel data (levels/funnel/funnel-report.json and funnel-bots.json).
#   Funnel   one row per level: role, box lanes, target / measured difficulty, trays, colours, marbles per colour, boxes per
#            size, blockers, tutorial or popup, slide and tray shape, greedy time at 1x and 2x, random-bot results
#   Curve    target vs measured difficulty (line chart), marbles per level (bar chart)
#   Summary  total playtime at 1x and 2x, first-session estimate (levels 1-12), blocker intro levels, levels per role
# Totals, 2x times, win rates, the in-band check and the measured difficulty are formulas (the sheet recalculates).
#   python3 tools/make-funnel-xlsx.py        (needs openpyxl; then recalc so the file carries values)
import json, os
from openpyxl import Workbook
from openpyxl.chart import LineChart, BarChart, Reference
from openpyxl.comments import Comment
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

ROOT = os.path.join(os.path.dirname(__file__), '..')
DIR = os.path.join(ROOT, 'levels', 'funnel')
rep = json.load(open(os.path.join(DIR, 'funnel-report.json')))['levels']
bots = json.load(open(os.path.join(DIR, 'funnel-bots.json')))
order = json.load(open(os.path.join(DIR, 'funnel-order.json')))['levels']
B = {r['id']: r for r in bots['levels']}
N = len(order)

F = 'Arial'
font = Font(name=F, size=10)
bold = Font(name=F, size=10, bold=True)
head = Font(name=F, size=10, bold=True, color='FFFFFF')
title = Font(name=F, size=14, bold=True)
note = Font(name=F, size=9, italic=True, color='555555')
headFill = PatternFill('solid', fgColor='2B5FA8')
inFill = PatternFill('solid', fgColor='E2F2DC')
thin = Side(style='thin', color='C8CFDA')
grid = Border(left=thin, right=thin, top=thin, bottom=thin)
wrap = Alignment(wrap_text=True, vertical='top')
center = Alignment(horizontal='center', vertical='top')

ROLE_TUT = {'first-sends': 'Tutorial: hand pointer, first sends', 'slot-wait': 'Tutorial: a box waits in its slot'}
POPUP = {'hidden': 'Intro popup: Hidden Box', 'connected': 'Intro popup: Connected Boxes', 'hiddenMarbles': 'Intro popup: Hidden Marbles',
         'dispenser': 'Intro popup: Marble Dispenser', 'lock': 'Intro popup: Lock & Key'}
HINT = {'triple': 'Short hint: triple connected boxes'}

wb = Workbook()

# ------------------------------------------------------------------ Summary (first: its scale table is referenced)
S = wb.active
S.title = 'Summary'
# difficulty scale: random-bot win rate at the centre of each target band (ascending rate) -> difficulty
SCALE = [(0.0, 10), (0.115, 9), (0.17, 8), (0.24, 7), (0.325, 6), (0.425, 5), (0.525, 4), (0.65, 3), (0.85, 2), (1.0, 1)]
SC_ROW = 46          # the scale table sits low on the Summary sheet
RATE = f'Summary!$A${SC_ROW + 2}:$A${SC_ROW + 1 + len(SCALE)}'
DIFF = f'Summary!$B${SC_ROW + 2}:$B${SC_ROW + 1 + len(SCALE)}'

# ------------------------------------------------------------------ Funnel
W = wb.create_sheet('Funnel')
cols = [('Level', 7), ('Id', 6), ('Role', 24), ('Lanes', 6), ('Target diff', 8), ('Band low', 8), ('Band high', 8), ('Random win rate', 9),
        ('Measured diff', 9), ('In band', 8), ('Trays (columns x rows)', 22), ('Trays', 7), ('Colours', 8), ('Marbles', 9),
        ('Marbles per colour', 34), ('Boxes 4', 7), ('Boxes 6', 7), ('Boxes 8', 7), ('Boxes 12', 7),
        ('Boxes total', 7), ('Blockers', 30), ('Tutorial / popup', 30), ('Slide shape', 22), ('Tray shape', 30),
        ('Greedy 1x (s)', 9), ('Greedy 2x (s)', 9), ('Random wins', 8), ('Random fails', 8), ('Random unfinished', 10),
        ('Tray changes (did not fit as asked)', 40)]
for c, (name, w) in enumerate(cols, 1):
    cell = W.cell(row=1, column=c, value=name)
    cell.font, cell.fill, cell.alignment, cell.border = head, headFill, Alignment(wrap_text=True, vertical='center', horizontal='center'), grid
    W.column_dimensions[get_column_letter(c)].width = w
W.row_dimensions[1].height = 44
W.freeze_panes = 'E2'
L = {name: get_column_letter(i) for i, (name, _) in enumerate(cols, 1)}

for i, fid in enumerate(order):
    r, b, row = rep[fid], B[fid], i + 2
    trays = ', '.join(f"{x['cols']}x{x['rows']}" for x in r['trays'])
    per = ', '.join(f"{p['color']} {p['marbles']}" for p in r['colors'])
    tp = ROLE_TUT.get(r.get('tutorial')) or POPUP.get(r.get('popup')) or HINT.get(r.get('hint')) or '-'
    kinds = sorted(set(x['kind'] for x in r['trays']))
    vals = {
        'Level': r['n'], 'Id': fid, 'Role': r['role'], 'Lanes': r.get('lanes', 3), 'Target diff': r['diff'], 'Band low': r['band'][0], 'Band high': r['band'][1],
        'Random win rate': f"={L['Random wins']}{row}/({L['Random wins']}{row}+{L['Random fails']}{row}+{L['Random unfinished']}{row})",
        'Measured diff': (f"=IF({L['Random win rate']}{row}>=1,1,INDEX({DIFF},MATCH({L['Random win rate']}{row},{RATE},1))"
                          f"+({L['Random win rate']}{row}-INDEX({RATE},MATCH({L['Random win rate']}{row},{RATE},1)))"
                          f"*(INDEX({DIFF},MATCH({L['Random win rate']}{row},{RATE},1)+1)-INDEX({DIFF},MATCH({L['Random win rate']}{row},{RATE},1)))"
                          f"/(INDEX({RATE},MATCH({L['Random win rate']}{row},{RATE},1)+1)-INDEX({RATE},MATCH({L['Random win rate']}{row},{RATE},1))))"),
        'In band': f"=AND({L['Random win rate']}{row}>={L['Band low']}{row},{L['Random win rate']}{row}<={L['Band high']}{row})",
        'Trays (columns x rows)': trays, 'Trays': len(r['trays']), 'Colours': len(r['colors']), 'Marbles': r['marbles'],
        'Marbles per colour': per,
        'Boxes 4': r['boxes'].get('4', 0), 'Boxes 6': r['boxes'].get('6', 0), 'Boxes 8': r['boxes'].get('8', 0), 'Boxes 12': r['boxes'].get('12', 0),
        'Boxes total': f"=SUM({L['Boxes 4']}{row}:{L['Boxes 12']}{row})",
        'Blockers': r['blockers'], 'Tutorial / popup': tp, 'Slide shape': r['slide'],
        'Tray shape': f"{r['trayIdea']} (built: {', '.join(kinds)})",
        'Greedy 1x (s)': b['greedy']['t1x'], 'Greedy 2x (s)': f"={L['Greedy 1x (s)']}{row}/2",
        'Random wins': b['random']['wins'], 'Random fails': b['random']['fails'], 'Random unfinished': b['random']['unfinished'],
        'Tray changes (did not fit as asked)': '; '.join(r.get('notes') or []) or '-',
    }
    for c, (name, _) in enumerate(cols, 1):
        cell = W.cell(row=row, column=c, value=vals[name])
        cell.font, cell.border = font, grid
        cell.alignment = wrap if isinstance(vals[name], str) and not vals[name].startswith('=') and len(vals[name]) > 10 else center
    for name in ('Band low', 'Band high', 'Random win rate'):
        W[f'{L[name]}{row}'].number_format = '0.0%'
    W[f"{L['Measured diff']}{row}"].number_format = '0.0'
    W[f"{L['Greedy 2x (s)']}{row}"].number_format = '0.0'
LAST = N + 1
# totals row
tr = LAST + 1
W.cell(row=tr, column=1, value='Total').font = bold
for name in ('Marbles', 'Boxes total', 'Greedy 1x (s)', 'Greedy 2x (s)', 'Random wins', 'Random fails', 'Random unfinished'):
    c = W[f'{L[name]}{tr}']; c.value = f'=SUM({L[name]}2:{L[name]}{LAST})'; c.font = bold; c.number_format = '0.0' if 'Greedy' in name else '0'
c = W[f"{L['In band']}{tr}"]; c.value = f'=COUNTIF({L["In band"]}2:{L["In band"]}{LAST},TRUE)&" / {N}"'; c.font = bold
W.conditional_formatting.add(f"{L['In band']}2:{L['In band']}{LAST}",
                             __import__('openpyxl').formatting.rule.CellIsRule(operator='equal', formula=['TRUE'], fill=inFill))
nr = tr + 2
notes = [
    'Target diff and band: the design table (random-bot win rate band per difficulty: 1-2 >= 70%, 3: 55-75%, 4: 45-60%, 5: 35-50%, 6: 25-40%, 7: 18-30%, 8: 12-22%, 9: 8-15%).',
    f"Random bot: {bots['runs']} games per level (seeds 1000-1199), a uniformly random legal send (a front box to a free slot) every 0.4 s of game time. Win rate = wins / games.",
    'Random fails: Out of Space - all 5 slots hold boxes, nothing is moving and no tray front can go to any of them. Unfinished: no result after 1500 game seconds. Unfinished games count as not won.',
    'Measured diff: the win rate placed on the difficulty scale on the Summary sheet (straight-line between band centres).',
    'Greedy 1x: game seconds for the greedy bot (sends the box that gets the most marbles at once, waits while marbles are moving when nothing gains). 2x = the same game at double speed.',
    'Levels 1-5 cannot be lost (no fail before level 6): each was played 1000 times by the random bot and 6 times by an adversarial bot without a loss. That puts levels 3 and 4 above their bands.',
    'Lanes: box lanes (2-5). Challenge, Milestone, Finale and Practice levels must land in their band; Relax, Fun and Teach levels may be easier.',
    'Out of band, closest version kept: ' + (', '.join(f"{fid} ({rep[fid]['rate']*100:.1f}%, band {rep[fid]['band'][0]*100:.0f}-{rep[fid]['band'][1]*100:.0f}%)" for fid in order
        if rep[fid]['role'].split(' ')[0] in ('Challenge', 'Milestone', 'Finale', 'Practice') and not rep[fid]['inBand']) or 'none')
    + '.',
]
for k, t in enumerate(notes):
    c = W.cell(row=nr + k, column=1, value=t); c.font = note

# ------------------------------------------------------------------ Curve
V = wb.create_sheet('Curve')
for c, (name, w) in enumerate([('Level', 8), ('Target diff', 11), ('Measured diff', 13), ('Marbles', 10)], 1):
    cell = V.cell(row=1, column=c, value=name); cell.font, cell.fill, cell.border = head, headFill, grid
    V.column_dimensions[get_column_letter(c)].width = w
for i in range(N):
    row = i + 2
    for c, name in enumerate(['Level', 'Target diff', 'Measured diff', 'Marbles'], 1):
        cell = V.cell(row=row, column=c, value=f"=Funnel!{L[name]}{row}"); cell.font, cell.border = font, grid
    V[f'C{row}'].number_format = '0.0'
lc = LineChart()
lc.title = 'Difficulty per level: target vs measured'
lc.y_axis.title = 'Difficulty (1-10)'; lc.x_axis.title = 'Level'
lc.y_axis.scaling.min = 0; lc.y_axis.scaling.max = 10
lc.add_data(Reference(V, min_col=2, max_col=3, min_row=1, max_row=N + 1), titles_from_data=True)
lc.set_categories(Reference(V, min_col=1, min_row=2, max_row=N + 1))
lc.height, lc.width = 9, 26
# straight segments between levels (no smoothing), target dashed blue, measured solid orange with markers
for ser, color, dash in ((lc.series[0], '2A78D6', 'dash'), (lc.series[1], 'EB6834', None)):
    ser.smooth = False
    ser.graphicalProperties.line.solidFill = color
    ser.graphicalProperties.line.width = 22000
    if dash: ser.graphicalProperties.line.dashStyle = dash
    ser.marker.symbol = 'none' if dash else 'circle'
    if not dash:
        ser.marker.size = 6; ser.marker.graphicalProperties.solidFill = color; ser.marker.graphicalProperties.line.solidFill = 'FFFFFF'
lc.legend.position = 't'
lc.x_axis.delete = False; lc.y_axis.delete = False
lc.y_axis.majorUnit = 1
V.add_chart(lc, 'F2')
bc = BarChart()
bc.type = 'col'; bc.title = 'Marbles per level'; bc.y_axis.title = 'Marbles'; bc.x_axis.title = 'Level'
bc.add_data(Reference(V, min_col=4, max_col=4, min_row=1, max_row=N + 1), titles_from_data=True)
bc.set_categories(Reference(V, min_col=1, min_row=2, max_row=N + 1))
bc.height, bc.width = 9, 26
bc.legend = None
bc.series[0].graphicalProperties.solidFill = '2A78D6'; bc.series[0].graphicalProperties.line.noFill = True
bc.gapWidth = 40
bc.x_axis.delete = False; bc.y_axis.delete = False
V.add_chart(bc, 'F22')

# ------------------------------------------------------------------ Summary
S.column_dimensions['A'].width = 44; S.column_dimensions['B'].width = 16; S.column_dimensions['C'].width = 16; S.column_dimensions['D'].width = 46
S['A1'] = 'Marble Run - 40-level funnel'; S['A1'].font = title
def hrow(r, labels):
    for c, t in enumerate(labels, 1):
        cell = S.cell(row=r, column=c, value=t); cell.font, cell.fill, cell.border = head, headFill, grid
def put(r, c, v, fmt=None, f=font):
    cell = S.cell(row=r, column=c, value=v); cell.font, cell.border = f, grid
    if fmt: cell.number_format = fmt
    return cell
G1, G2 = L['Greedy 1x (s)'], L['Greedy 2x (s)']
hrow(3, ['Playtime (greedy bot)', 'Seconds', 'Minutes', 'Note'])
put(4, 1, 'Total, all 40 levels, at 1x'); put(4, 2, f'=SUM(Funnel!{G1}2:{G1}{LAST})', '0'); put(4, 3, '=B4/60', '0.0')
put(4, 4, 'Game time of the greedy bot (a player who never waits needlessly)')
put(5, 1, 'Total, all 40 levels, at 2x'); put(5, 2, f'=SUM(Funnel!{G2}2:{G2}{LAST})', '0'); put(5, 3, '=B5/60', '0.0')
put(5, 4, 'Target: at least 35 minutes at 2x')
put(6, 1, 'Meets the 35-minute target at 2x'); put(6, 2, '=C5>=35'); put(6, 3, ''); put(6, 4, '')
hrow(8, ['First session estimate (levels 1-12)', 'Seconds', 'Minutes', 'Note'])
put(9, 1, 'Levels 1-12 at 1x'); put(9, 2, f'=SUM(Funnel!{G1}2:{G1}13)', '0'); put(9, 3, '=B9/60', '0.0'); put(9, 4, 'Greedy play: the fastest clean run')
put(10, 1, 'Levels 1-12 at 2x'); put(10, 2, f'=SUM(Funnel!{G2}2:{G2}13)', '0'); put(10, 3, '=B10/60', '0.0'); put(10, 4, '')
put(11, 1, 'Levels 1-12 at 1x, with menus and retries'); put(11, 2, '=B9*B12', '0'); put(11, 3, '=B11/60', '0.0')
put(11, 4, 'Greedy time times the factor below')
put(12, 1, 'Factor for a first-time player (assumption)'); c = put(12, 2, 1.5, '0.0'); c.font = Font(name=F, size=10, color='0000FF'); put(12, 3, ''); put(12, 4, 'Assumption, edit to taste: popups, tutorials, thinking and the odd retry')
hrow(14, ['Blocker introductions', 'Level', '', 'How it is introduced'])
intro = [('Hidden Box', 7, 'Intro popup (first appearance only)'), ('Connected Boxes (pairs)', 13, 'Intro popup (first appearance only)'),
         ('Connected triples', 17, 'Short non-blocking hint'), ('Hidden Box + Connected (first combination)', 21, 'No popup'),
         ('Hidden Marbles', 22, 'Intro popup (first appearance only)'), ('Marble Dispenser', 26, 'Intro popup (first appearance only)'),
         ('Lock & Key', 32, 'Intro popup (first appearance only)'), ('Every blocker together', 40, 'No popup (finale)')]
for k, (n, lvl, how) in enumerate(intro):
    put(15 + k, 1, n); put(15 + k, 2, lvl); put(15 + k, 3, ''); put(15 + k, 4, how)
r0 = 15 + len(intro) + 1
hrow(r0, ['Levels per role', 'Levels', '', ''])
RC = L['Role']
roles = ['Tutorial', 'Teach', 'Practice', 'Fun', 'Relax', 'Challenge', 'Milestone', 'Finale']
for k, role in enumerate(roles):
    put(r0 + 1 + k, 1, role); put(r0 + 1 + k, 2, f'=COUNTIF(Funnel!{RC}2:{RC}{LAST},"{role}*")'); put(r0 + 1 + k, 3, ''); put(r0 + 1 + k, 4, '')
rt = r0 + 1 + len(roles)
put(rt, 1, 'Total', f=bold); put(rt, 2, f'=SUM(B{r0 + 1}:B{rt - 1})', f=bold); put(rt, 3, ''); put(rt, 4, '')
LC = L['Lanes']
hrow(rt + 4, ['Levels per box-lane count', 'Levels', '', 'Which'])
for k, nl in enumerate([2, 3, 4, 5]):
    put(rt + 5 + k, 1, f'{nl} lanes'); put(rt + 5 + k, 2, f'=COUNTIF(Funnel!{LC}2:{LC}{LAST},{nl})'); put(rt + 5 + k, 3, '')
    put(rt + 5 + k, 4, ', '.join(f for f in order if rep[f].get('lanes', 3) == nl) if nl != 3 else 'all others')
put(rt + 2, 1, 'Levels in their difficulty band'); put(rt + 2, 2, f'=COUNTIF(Funnel!{L["In band"]}2:{L["In band"]}{LAST},TRUE)'); put(rt + 2, 3, ''); put(rt + 2, 4, 'Random-bot win rate inside the target band')
assert rt + 9 < SC_ROW - 1, 'the scale table would overlap'
S.cell(row=SC_ROW, column=1, value='Difficulty scale (used by Funnel!Measured diff)').font = bold
hrow(SC_ROW + 1, ['Random win rate (band centre)', 'Difficulty', '', 'Note'])
for k, (rate, d) in enumerate(SCALE):
    put(SC_ROW + 2 + k, 1, rate, '0.0%'); put(SC_ROW + 2 + k, 2, d); put(SC_ROW + 2 + k, 3, '')
    put(SC_ROW + 2 + k, 4, 'Centre of the target band' if 2 <= d <= 9 else ('All wins' if d == 1 else 'No wins'))
S.cell(row=SC_ROW + 2 + len(SCALE), column=1, value='Between two rows the difficulty is read off a straight line.').font = note

wb.move_sheet('Summary', offset=2)          # tab order: Funnel, Curve, Summary
wb.active = 0
out = os.path.join(ROOT, 'dist', 'funnel.xlsx')
os.makedirs(os.path.dirname(out), exist_ok=True)
wb.save(out)
print('dist/funnel.xlsx', os.path.getsize(out) // 1024, 'KB')
