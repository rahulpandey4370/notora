# Food research: output format

Each category writes one JSON file in this folder:

```json
{
  "items": [
    {
      "name": "Kurkure Masala Munch",
      "brand": "Kurkure (PepsiCo India)",
      "group": "Chips & namkeen",
      "aliases": ["masala munch"],
      "unit": "g",
      "kcal": 554, "proteinG": 6.6, "carbsG": 55.4, "fatG": 34.3, "fiberG": null,
      "servings": [{ "label": "small pack", "amount": 35 }],
      "source": "https://…",
      "sourceBasis": "per 100 g, printed nutrition table on the pack",
      "quote": "Energy 554 kcal | Protein 6.6 g | Carbohydrate 55.4 g | Total Fat 34.3 g",
      "energyNote": "optional: why kcal ≠ 4P+4C+9F (e.g. contains polyols)"
    }
  ],
  "notFound": [{ "name": "Kurkure Xyz", "reason": "no label found on brand site, BigBasket, Amazon or Open Food Facts" }]
}
```

Rules:
- `unit` "g" means values are per 100 g, "ml" per 100 ml, "serving" per 1 piece/serving (use only when the source gives no per-100 basis, e.g. a pizza or a bar sold singly; then put the serving size in the name, e.g. "… (1 bar, 60 g)").
- Convert per-serving label values to per 100 g yourself only if the label states the serving weight; say so in `sourceBasis`.
- `fiberG`: null when the label doesn't state fibre. Never guess.
- kJ: convert to kcal (÷ 4.184) only if the source gives only kJ; say so in `sourceBasis`.
- `servings`: real pack sizes / piece weights from the source (e.g. "pack" 35 g, "slice" 30 g, "biscuit" 7.5 g). Don't invent them.
- `source` must be the page you actually read the numbers on (brand site, the brand's nutrition PDF, BigBasket/Amazon/Blinkit product page with the label text, Open Food Facts product page, INDB/IFCT/USDA FoodData Central). Search-result snippets and calorie-counting aggregator sites (HealthifyMe, Nutritionix, fatsecret, myfitnesspal, etc.) are NOT sources.
- If you can't find a trustworthy source, put the item in `notFound`. Missing is fine; a guess is not.
- Before finishing, run: `npx tsx validate.mts <your file>` from the project root
  `/Users/rahul.pandey/experiments/p-projects/notora` (path to validate.mts: this folder). Fix every ERROR.
