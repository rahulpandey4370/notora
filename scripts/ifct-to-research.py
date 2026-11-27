# Converts IFCT 2017 (NIN-ICMR) into data/food-research/ifct.json.
# Data: the MIT-licensed @ifct2017/compositions@2.0.9 (later versions are AGPL; do not use them):
#   curl -sO https://registry.npmjs.org/@ifct2017/compositions/-/compositions-2.0.9.tgz && tar xzf compositions-2.0.9.tgz
# Run: python3 scripts/ifct-to-research.py package/index.csv data/food-research/ifct.json
import csv, json, re, sys
src_csv, out = sys.argv[1], sys.argv[2]
rows = list(csv.reader(open(src_csv)))
h = [c.split('; ')[1] for c in rows[0]]
R = {r[0]: dict(zip(h, r)) for r in rows[1:]}
SRC = 'https://registry.npmjs.org/@ifct2017/compositions/-/compositions-2.0.9.tgz'
USDA_EGG = 'USDA FoodData Central 171287/173424: 1 large egg = 50 g'
# code: (group, display name, aliases, servings)
EGG = [('egg', 50)]
CUR = {
 # Fruits
 'E001': ('Fruits', 'Apple', ['seb'], []), 'E002': ('Fruits', 'Apple, green', ['green apple'], []), 'E004': ('Fruits', 'Apple, Kashmiri', ['kashmiri apple'], []),
 'E012': ('Fruits', 'Banana (robusta)', ['banana', 'kela'], []), 'E011': ('Fruits', 'Banana, red', ['red banana'], []), 'E010': ('Fruits', 'Banana, poovan (small)', ['elaichi banana', 'small banana'], []),
 'E028': ('Fruits', 'Guava, white', ['guava', 'amrood', 'amrud'], []), 'E029': ('Fruits', 'Guava, pink', ['pink guava'], []),
 'E051': ('Fruits', 'Pear', ['nashpati', 'naspati'], []), 'E049': ('Fruits', 'Papaya, ripe', ['papaya', 'papita'], []),
 'E055': ('Fruits', 'Pomegranate', ['anar', 'pomegranate seeds'], []),
 'E066': ('Fruits', 'Watermelon', ['tarbooz', 'tarbuj'], []), 'E065': ('Fruits', 'Watermelon, sugar baby', [], []),
 'E026': ('Fruits', 'Grapes, green seedless', ['grapes', 'angoor', 'green grapes'], []), 'E027': ('Fruits', 'Grapes, black seedless', ['black grapes'], []),
 'E039': ('Fruits', 'Mango, kesar', ['mango', 'aam'], []), 'E036': ('Fruits', 'Mango, banganapalli', ['banganapalli'], []), 'E042': ('Fruits', 'Mango, totapuri', ['totapuri'], []),
 'E047': ('Fruits', 'Orange', ['santra', 'orange pulp'], []), 'E034': ('Fruits', 'Sweet lime (mosambi)', ['mosambi', 'musambi', 'sweet lime'], []),
 'E053': ('Fruits', 'Pineapple', ['ananas'], []), 'E045': ('Fruits', 'Muskmelon', ['kharbuja', 'kharbooja', 'cantaloupe'], []),
 'E060': ('Fruits', 'Chikoo (sapota)', ['chiku', 'sapota'], []), 'E035': ('Fruits', 'Litchi', ['lychee'], []), 'E063': ('Fruits', 'Strawberry', [], []),
 'E016': ('Fruits', 'Custard apple', ['sitaphal', 'sharifa'], []), 'E030': ('Fruits', 'Jackfruit, ripe', ['kathal'], []),
 'E054': ('Fruits', 'Plum', ['aloo bukhara'], []), 'E050': ('Fruits', 'Peach', ['aadu'], []), 'E014': ('Fruits', 'Cherries', ['cherry'], []),
 'E020': ('Fruits', 'Fig, fresh', ['anjeer', 'fig'], []), 'E018': ('Fruits', 'Dates, dry (dark)', ['khajur', 'dates'], []),
 'E057': ('Fruits', 'Raisins, black', ['kishmish', 'black raisins'], []), 'E058': ('Fruits', 'Raisins, golden', ['golden raisins'], []),
 'E021': ('Fruits', 'Amla (Indian gooseberry)', ['amla', 'gooseberry'], []), 'E031': ('Fruits', 'Jamun', ['java plum'], []), 'E007': ('Fruits', 'Avocado', [], []),
 # Vegetables (raw)
 'G017': ('Vegetables', 'Onion', ['pyaz', 'pyaaz', 'kanda'], []), 'D076': ('Vegetables', 'Tomato', ['tamatar'], []),
 'D043': ('Vegetables', 'Cucumber', ['kheera', 'kakdi'], []), 'F002': ('Vegetables', 'Carrot', ['gajar'], []), 'F001': ('Vegetables', 'Beetroot', ['chukandar'], []),
 'F006': ('Vegetables', 'Potato', ['aloo', 'alu'], []), 'F013': ('Vegetables', 'Sweet potato', ['shakarkandi'], []), 'D036': ('Vegetables', 'Cauliflower', ['gobi', 'phool gobi'], []),
 'C015': ('Vegetables', 'Cabbage', ['patta gobi', 'band gobi'], []), 'C033': ('Vegetables', 'Spinach', ['palak'], []), 'C020': ('Vegetables', 'Fenugreek leaves', ['methi'], []),
 'D033': ('Vegetables', 'Capsicum, green', ['shimla mirch', 'capsicum', 'bell pepper'], []), 'D034': ('Vegetables', 'Capsicum, red', ['red bell pepper'], []), 'D035': ('Vegetables', 'Capsicum, yellow', ['yellow bell pepper'], []),
 'D056': ('Vegetables', 'Ladies finger (okra)', ['bhindi', 'okra'], []), 'D031': ('Vegetables', 'Brinjal', ['baingan', 'eggplant', 'aubergine'], []),
 'D007': ('Vegetables', 'Bottle gourd', ['lauki', 'ghiya', 'dudhi'], []), 'D004': ('Vegetables', 'Bitter gourd', ['karela'], []), 'D068': ('Vegetables', 'Ridge gourd', ['turai', 'tori'], []),
 'D066': ('Vegetables', 'Pumpkin', ['kaddu', 'sitaphal sabzi'], []), 'D061': ('Vegetables', 'Peas, fresh', ['matar', 'green peas'], []), 'D050': ('Vegetables', 'French beans', ['beans'], []),
 'D039': ('Vegetables', 'Cluster beans', ['gawar', 'guar'], []), 'D046': ('Vegetables', 'Drumstick', ['moringa', 'sahjan'], []), 'D073': ('Vegetables', 'Tinda', ['round gourd'], []),
 'D060': ('Vegetables', 'Parwal', ['pointed gourd', 'parval'], []), 'F010': ('Vegetables', 'Radish', ['mooli'], []), 'C025': ('Vegetables', 'Lettuce', [], []),
 'J001': ('Vegetables', 'Button mushroom', ['mushroom'], []), 'D042': ('Vegetables', 'Baby corn', [], []), 'A008': ('Vegetables', 'Sweet corn', ['corn', 'bhutta', 'makka'], []),
 'D077': ('Vegetables', 'Zucchini', [], []), 'G009': ('Vegetables', 'Coriander leaves', ['dhania', 'cilantro'], []), 'G016': ('Vegetables', 'Mint leaves', ['pudina'], []),
 'G014': ('Vegetables', 'Ginger', ['adrak'], []), 'G011': ('Vegetables', 'Garlic', ['lehsun', 'lahsun'], []), 'G008': ('Vegetables', 'Green chilli', ['hari mirch'], []),
 'D001': ('Vegetables', 'Ash gourd', ['petha'], []), 'F017': ('Vegetables', 'Yam (suran)', ['suran', 'jimikand'], []), 'C009': ('Vegetables', 'Beet greens', [], []),
 # Eggs
 'M001': ('Eggs', 'Egg, raw (whole)', ['raw egg', 'egg', 'anda'], EGG), 'M004': ('Eggs', 'Egg, boiled', ['boiled egg', 'hard boiled egg', 'egg', 'ubla anda'], EGG),
 'M002': ('Eggs', 'Egg white, raw', ['egg white', 'raw egg white'], []), 'M005': ('Eggs', 'Egg white, boiled', ['boiled egg white'], []),
 'M003': ('Eggs', 'Egg yolk, raw', ['egg yolk'], []), 'M006': ('Eggs', 'Egg yolk, boiled', ['boiled egg yolk'], []),
 'M007': ('Eggs', 'Omelette (IFCT)', ['omelette', 'omelet', 'omlet'], []), 'M009': ('Eggs', 'Country egg (desi), boiled', ['desi egg', 'country egg'], []),
 # Chicken raw
 'N003': ('Chicken', 'Chicken breast, raw (skinless)', ['chicken breast', 'raw chicken breast'], []), 'N002': ('Chicken', 'Chicken thigh, raw (skinless)', ['chicken thigh'], []),
 'N001': ('Chicken', 'Chicken leg, raw (skinless)', ['chicken leg', 'drumstick chicken'], []), 'N004': ('Chicken', 'Chicken wing, raw (skinless)', ['chicken wing'], []),
 'N005': ('Chicken', 'Chicken liver, raw', ['kaleji', 'chicken liver'], []), 'N006': ('Chicken', 'Chicken gizzard, raw', ['gizzard'], []),
 # Staples
 'I001': ('Staples', 'Jaggery', ['gur', 'gud'], []), 'K002': ('Drinks', 'Coconut water', ['nariyal pani', 'tender coconut water'], []),
 'T013': ('Staples', 'Ghee', ['desi ghee'], [('tsp', 5)]),
}
CUR['T013'] = ('Staples', 'Ghee', ['desi ghee'], [])
for code, name, al in [('T006', 'Mustard oil', ['sarson ka tel', 'sarson oil']), ('T005', 'Groundnut oil', ['peanut oil', 'moongphali tel']),
                       ('T012', 'Sunflower oil', []), ('T008', 'Rice bran oil', []), ('T001', 'Coconut oil', ['nariyal tel'])]:
    CUR[code] = ('Staples', name, al + ['oil', 'cooking oil'], [])  # no sourced tsp weight
f = lambda x: float(x or 0)
items = []
for code, r in R.items():
    kj_calc = 17*f(r['protcnt']) + 37*f(r['fatce']) + 17*f(r['choavldf']) + 8*f(r['fibtg']) + 13*f(r['orgac'])
    fixed = f(r['enerc']) == 0 or abs(f(r['enerc']) - kj_calc) > max(0.4 * kj_calc, 200)
    kcal = round((kj_calc if fixed else f(r['enerc'])) / 4.184)
    hindi = re.search(r'(?:^|; )H\. ([^;.]+)', r['lang'] or '')
    hal = [a.strip().lower() for a in hindi.group(1).split(',')] if hindi else []
    if code in CUR:
        g, name, al, sv = CUR[code]
    else:
        g, name, al, sv = 'Ingredients', r['name'], [], []
    aliases = list(dict.fromkeys([a for a in al + hal if a and a != name.lower()]))
    it = {'name': name, 'group': g, 'aliases': aliases, 'unit': 'g', 'kcal': kcal,
          'proteinG': round(f(r['protcnt']), 1), 'carbsG': round(f(r['choavldf']), 1), 'fatG': round(f(r['fatce']), 1), 'fiberG': round(f(r['fibtg']), 1),
          'servings': [{'label': l, 'amount': a} for l, a in sv], 'source': SRC,
          'sourceBasis': f"IFCT 2017 (NIN-ICMR) food {code} '{r['name']}', per 100 g edible portion; energy given in kJ, converted ÷4.184" + ('; ' + USDA_EGG if sv == EGG else ''),
          **({'energyNote': f"IFCT row energy {r['enerc']} kJ is missing/inconsistent with its own composition; recomputed with IFCT factors (P17, F37, C17, fibre 8, organic acids 13 kJ/g) = {round(kj_calc)} kJ"} if fixed else {}),
          'quote': f"{code} enerc {r['enerc']} kJ, protcnt {r['protcnt']}, choavldf {r['choavldf']}, fatce {r['fatce']}, fibtg {r['fibtg']} (g/100 g)"}
    atw = 4*it['proteinG'] + 4*it['carbsG'] + 9*it['fatG']
    if not fixed and min(abs(kcal-atw), abs(kcal-atw-2*it['fiberG'])) > max(0.15*kcal, 20):
        it['energyNote'] = f"IFCT's published energy kept; it counts components beyond protein/carbs/fat (organic acids {r['orgac']} g, fibre {r['fibtg']} g)"
    items.append(it)
# names must be unique
seen = {}
for it in items:
    k = it['name'].lower()
    if k in seen:
        seen[k] += 1; it['name'] = f"{it['name']} ({seen[k]})"
    else: seen[k] = 1
json.dump({'items': items, 'notFound': []}, open(out, 'w'), ensure_ascii=False, indent=1)
print(len(items), 'items;', sum(1 for i in items if i['group'] != 'Ingredients'), 'curated')
