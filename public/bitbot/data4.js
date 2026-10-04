/*
 * Copyright 2026 bittuhere
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ═══════════════════════════════════════════════════════════════════════════
   BitBot KNOWLEDGE EXPANSION v10 — CLASS 8 MASTERY (DAV Secondary Mathematics,
   all 16 chapters). Concept questions get textbook-perfect answers here;
   NUMERICALS are solved exactly by BitMath (math.js) + BitWords (wordmath.js)
   before the net is ever consulted. Loaded AFTER data3.js.
   ═════════════════════════════════════════════════════════════════════════ */
(function (root) {
    'use strict';
    var BitData = (typeof module !== 'undefined' && module.exports) ? require('./data3.js') : root.BitData;
    var INTENTS = BitData.INTENTS;

    /* ── CH 1 · properties of square numbers + Pythagorean triplets ───────── */
    INTENTS.push({ tag: "m8_square_props", patterns: [
        "properties of perfect squares", "properties of square numbers", "what are the properties of a perfect square",
        "pythagorean triplet", "pythagorean triplets", "what is a pythagorean triplet", "give examples of pythagorean triplets",
        "how to find pythagorean triplets", "formula for pythagorean triplet", "numbers between two square numbers",
        "square number ending in 2 3 7 8", "sum of first n odd numbers", "perfect square ke gun", "pythagoras triplet kya hota hai"
    ], responses: [
        "🔢 **Perfect squares — the secret properties (Ch 1):**\n- A number ending in **2, 3, 7 or 8 is NEVER** a perfect square (but ending in 1,4,5,6,9,0 *may* be — 26 ends in 6 yet isn't a square!)\n- **Even² = even, Odd² = odd**\n- Square of a number ending in **5** always ends in **25**: 35² = 12|25 (3×4=12 prefix trick!)\n- Between n² and (n+1)² there are exactly **2n non-square numbers** (between 4² and 5²: 17,18,…,24 = 8 = 2×4 ✔)\n- **1+3+5+…(first n odd numbers) = n²** → 1+3+5+7+9 = 25 = 5²\n\n📐 **Pythagorean triplets** — three natural numbers with a² + b² = c²:\n(3,4,5) · (6,8,10) · (5,12,13) · (8,15,17) · (7,24,25) · (20,21,29) · (12,35,37)\n**Generator:** for any m > 1 → **(2m, m²−1, m²+1)** is a triplet. m=2 → (4,3,5) ✔  m=3 → (6,8,10) ✔\n\n_Try me: \"is 144 a perfect square\" or \"the two legs are 6 and 8 find the hypotenuse\" — I solve both with steps!_"
    ] });

    /* ── CH 1 · square-root methods ───────────────────────────────────────── */
    INTENTS.push({ tag: "m8_sqrt_methods", patterns: [
        "square root by repeated subtraction", "square root by prime factorisation", "square root by long division method",
        "methods to find square root", "how to find square root of a number step by step", "estimate square root",
        "estimating square roots", "square root of a decimal number", "square root of fraction",
        "long division method square root kaise kare", "square root nikalne ki vidhi", "repeated subtraction method explain"
    ], responses: [
        "√ **The 4 school methods to find a square root (Ch 1):**\n\n**1️⃣ Repeated subtraction** — subtract consecutive odd numbers 1, 3, 5, 7… until you hit 0. The COUNT of steps = √n.\n81: 81−1=80, −3=77, −5=72, −7=65, −9=56, −11=45, −13=32, −15=17, −17=0 → 9 steps → **√81 = 9** ✔\n\n**2️⃣ Prime factorisation** — factorise, make pairs, take one from each pair.\n√576: 576 = 2⁶×3² → pairs (2²·2²·… ) → √576 = 2³×3 = **24**\n\n**3️⃣ Long division** — for big numbers & decimals: bar digits in pairs from the right (and after the decimal), divide-and-bring-down like long division. √2025 = 45, √7.84 = 2.8\n\n**4️⃣ Estimation** — trap it between two perfect squares: 3 < √10 < 4 because 9 < 10 < 16 → √10 ≈ 3.1…\n\n**Fractions:** √(a/b) = √a/√b → √(49/121) = 7/11\n\n_Ask me \"find the square root of 576 by prime factorisation\" and watch the steps! 🎬_"
    ] });

    /* ── CH 2 · cubes & cube roots ───────────────────────────────────────── */
    INTENTS.push({ tag: "m8_cube_props", patterns: [
        "properties of cubes", "properties of cube numbers", "hardy ramanujan number", "what is 1729", "1729 story",
        "1729 special number", "cube root by prime factorisation", "cube of a negative number", "cube root of negative number",
        "cube number properties class 8", "cube ke gun", "1729 kyun vishesh hai", "taxicab number"
    ], responses: [
        "🧊 **Cubes & cube roots (Ch 2):**\n\n**Properties of cubes:**\n- Cube of an even number = even; cube of an odd = odd\n- Ending digits cycle: if n ends in 0,1,2,…,9 → n³ ends in **0,1,8,7,4,5,6,3,2,9** (so 2↔8 and 3↔7 swap!)\n- Cube of a multiple of 10 is always a multiple of 1000\n\n🚕 **Hardy–Ramanujan Number 1729** — the smallest number expressible as the sum of two cubes in TWO different ways:\n**1729 = 1³ + 12³ = 9³ + 10³** — Ramanujan spotted it instantly from a taxi number plate when Hardy called his hospital visit 'dull'! (Other such numbers: 4104, 13832…)\n\n**Cube root by prime factorisation:** group primes in TRIPLETS.\n∛1728: 1728 = 2⁶×3³ → (2²)×(3) = **12** ✔\n**Negatives:** (−2)³ = −8, so **∛(−8) = −2** — unlike square roots, cube roots of negatives are real!\n\n_Try: \"find the cube root of 1728 by prime factorisation\" or \"smallest number to multiply 392 to make a perfect cube\" — solved with steps!_"
    ] });

    /* ── CH 3 · exponent laws ─────────────────────────────────────────────── */
    INTENTS.push({ tag: "m8_exponent_laws", patterns: [
        "laws of exponents", "rules of exponents", "exponent laws class 8", "integral exponents", "negative exponents",
        "zero exponent rule", "rational exponents", "fractional exponents", "exponential form", "a to the power m times a to the power n",
        "ghat ke niyam", "exponents ke rules", "explain laws of exponents with examples"
    ], responses: [
        "⚡ **The 8 laws of exponents (Ch 3) — with a ≠ 0:**\n1. **aᵐ × aⁿ = aᵐ⁺ⁿ** → 2³×2⁴ = 2⁷ = 128\n2. **aᵐ ÷ aⁿ = aᵐ⁻ⁿ** → 5⁶÷5⁴ = 5² = 25\n3. **(aᵐ)ⁿ = aᵐⁿ** → (3²)⁴ = 3⁸\n4. **a⁰ = 1** (anything to the power zero!)\n5. **a⁻ⁿ = 1/aⁿ** → 2⁻³ = 1/8 (negative exponent = flip to denominator)\n6. **(ab)ⁿ = aⁿbⁿ** → (2×3)² = 4×9 = 36\n7. **(a/b)ⁿ = aⁿ/bⁿ** → (2/3)³ = 8/27\n8. **aᵐ/ⁿ = ⁿ√(aᵐ)** → 8²ᐟ³ = ∛(8²) = ∛64 = 4 (rational exponent = a ROOT!)\n\n**Standard (scientific) form:** 15,300,000 = 1.53 × 10⁷ · 0.000047 = 4.7 × 10⁻⁵\n\n_Quick fire: \"evaluate 2 to the power minus 3\" or \"simplify (3²)⁴ ÷ 3⁵\" — BitMath does it step by step!_"
    ] });

    /* ── CH 3 · radicals & surds ──────────────────────────────────────────── */
    INTENTS.push({ tag: "m8_radicals", patterns: [
        "what is a radical in maths", "what are surds", "radical and surd difference", "nth root of a",
        "simplifying radicals", "simplify surds", "convert radical to exponential form", "radical form to exponent form",
        "cube root symbol", "what does the radical sign mean", "mool kya hota hai", "radicals class 8"
    ], responses: [
        "🌱 **Radicals & surds (Ch 3):**\n\nA **radical** is any root written with the radical sign: **ⁿ√a** — read 'the n-th root of a'.\n- √a means ²√a (square root), ∛a = ³√a (cube root)\n- **ⁿ√a = a¹ᐟⁿ** — that's the bridge between radical and exponential form!\n- ⁴√81 = 3 because 3⁴ = 81 · ∛(−27) = −3\n\n**Rules:**\n- ⁿ√(ab) = ⁿ√a × ⁿ√b → √50 = √25×√2 = 5√2\n- ⁿ√(a/b) = ⁿ√a ÷ ⁿ√b\n- ᵐ√(ⁿ√a) = ᵐⁿ√a → √(∛a) = ⁶√a\n- (ⁿ√a)ⁿ = a\n\n**Surd** = an *irrational* root that can't be simplified away (√2, √3, ∛5…). √4 = 2 is a radical but NOT a surd (it resolves!).\n\n**Convert:** 5²ᐟ³ = ³√(5²) = ∛25 · and ⁵√(x³) = x³ᐟ⁵\n\n_Try: \"√50 simplify\" or \"convert 7 to the power 2/3 into radical form\"!_"
    ] });

    /* ── CH 4 · direct & inverse variation ───────────────────────────────── */
    INTENTS.push({ tag: "m8_variation", patterns: [
        "direct variation", "inverse variation", "direct and inverse variation", "direct proportion", "inverse proportion",
        "what is direct variation", "what is inverse variation", "x y equals k", "x over y equals k",
        "difference between direct and inverse variation", "direct proportion examples", "inverse proportion examples",
        "anupat samanchalan", "vyast anupat", "variation class 8 maths"
    ], responses: [
        "⚖️ **Direct vs Inverse Variation (Ch 4):**\n\n**Direct variation:** x increases → y increases at the SAME rate.\n**x/y = k** (constant) or **y = kx**\n- Cost & number of pens, distance & time at constant speed, petrol & its cost\n- Graph = a straight line through the ORIGIN 📈\n- If x₁/y₁ = x₂/y₂ → cross-multiply & solve\n\n**Inverse variation:** x increases → y DECREASES.\n**x × y = k** (constant) or **y = k/x**\n- Workers & days to finish a job, speed & time for a fixed distance, more mouths & days food lasts\n- Graph = a curve (hyperbola) 📉\n- If x₁y₁ = x₂y₂ → solve\n\n**Spot the difference:** ask 'if the first grows, does the second grow (direct) or shrink (inverse)?'\n\n_I solve both automatically: \"if 5 pens cost 25 rupees what is the cost of 8 pens\" (direct) or \"5 men finish work in 10 days how long will 25 men take\" (inverse) — with full steps! 🧮_"
    ] });

    /* ── CH 5 · commercial maths: discount, tax, GST ─────────────────────── */
    INTENTS.push({ tag: "m8_commercial", patterns: [
        "overhead expenses meaning", "what are overheads in profit loss", "discount percentage formula", "marked price and selling price relation",
        "sales tax meaning", "what is vat value added tax", "what is gst", "gst full form and rates", "cgst sgst igst difference",
        "gst class 8 maths", "discount kya hota hai", "sales tax aur gst me antar", "mp sp discount formula"
    ], responses: [
        "🛒 **Commercial maths toolkit (Ch 5):**\n\n**Overhead expenses** = extra costs (transport, repairs, packaging) added to the purchase price → they INCREASE your effective CP!\nEffective CP = purchase price + overheads\n\n**Discount chain:**\n- Discount is ALWAYS on the **Marked Price (MP)**\n- Discount amount = MP × d/100 · **SP = MP − discount** · d% = (discount/MP)×100\n\n**Profit/Loss:** Profit = SP − CP · Profit% = (Profit/CP)×100 (always on CP!)\n\n**Tax on purchases:**\n- **Sales Tax / VAT** — added to the bill: total = price + price×tax%\n- **GST** (Goods & Services Tax, India, 1 July 2017) — ONE tax replacing many. Slabs: **0%, 5%, 12%, 18%, 28%**\n  - **CGST + SGST** — sold within a state (18% GST = 9% CGST + 9% SGST)\n  - **IGST** — sold across states (18% IGST)\n\n_Try: \"bill of 2500 with GST 18% find total\" or \"MP 1200 discount 25% find SP\" — instant, with steps! 🧾_"
    ] });

    /* ── CH 6 · compound interest ─────────────────────────────────────────── */
    INTENTS.push({ tag: "m8_compound_int", patterns: [
        "simple interest vs compound interest", "difference between si and ci", "compound interest formula", "amount formula compound interest",
        "compound interest half yearly", "compound interest quarterly", "population growth formula compound interest",
        "depreciation formula", "value decreases every year formula", "ci minus si for 2 years", "compound interest chakravriddhi byaj",
        "janasankhya vriddhi formula", "avmoolyan kya hai"
    ], responses: [
        "🏦 **Simple vs Compound Interest (Ch 6):**\n\n**SI** = P·R·T/100 — interest ONLY on the principal (stays the same every year).\n**CI** — interest on principal **+ previous interest** ('interest on interest'!) — grows every year.\n\n**Amount formula:** **A = P(1 + R/100)ⁿ**, CI = A − P\n- **Annually:** R, n as given\n- **Half-yearly:** rate → **R/2**, time → **2n** (e.g. 10% p.a. half-yearly = 5% every 6 months, 2 periods/yr)\n- **Quarterly:** rate → **R/4**, time → **4n**\n\n**Shortcut:** for 2 years, **CI − SI = P(R/100)²** · e.g. P=10000, R=10% → diff = 10000×(1/100) = ₹100\n\n**Same formula, different clothes:**\n- 📈 **Population growth:** P(1 + R/100)ⁿ\n- 📉 **Depreciation** (value of car/machine falls): P(1 − R/100)ⁿ\n- 🦠 Bacteria count growth, area of a square growing… all A = P(1±R/100)ⁿ!\n\n_Try: \"CI on 10000 at 10% for 2 years compounded annually\" (or half-yearly/quarterly) — year-by-year table included! 📊_"
    ] });

    /* ── CH 7 · identities + clever numerical evaluation ─────────────────── */
    INTENTS.push({ tag: "m8_identities_use", patterns: [
        "algebraic identities class 8", "standard identities", "a plus b whole square", "a minus b whole square formula",
        "a square minus b square formula", "x plus a times x plus b identity", "a plus b plus c whole square",
        "evaluate using identity", "identities for numerical evaluation", "103 times 97 using identity", "beejganitiy sarvasamika",
        "sarvasamikayein class 8", "how many algebraic identities in class 8"
    ], responses: [
        "🧮 **The 5 standard identities (Ch 7) — memorise these and multiplication becomes mental magic:**\n1. **(a+b)² = a² + 2ab + b²**\n2. **(a−b)² = a² − 2ab + b²**\n3. **a² − b² = (a+b)(a−b)**\n4. **(x+a)(x+b) = x² + (a+b)x + ab**\n5. **(a+b+c)² = a² + b² + c² + 2ab + 2bc + 2ca**\n\n**Numerical evaluations — never multiply the hard way again:**\n- 103 × 97 = (100+3)(100−3) = 100² − 3² = **9991** (identity 3!)\n- 99² = (100−1)² = 10000 − 200 + 1 = **9801** (identity 2)\n- 51 × 49 = (50+1)(50−1) = 2500 − 1 = **2499**\n- 105 × 103 = (100+5)(100+3) = 10000 + 800 + 15 = **10815** (identity 4)\n- (9.8)² = (10−0.2)² = 100 − 4 + 0.04 = **96.04**\n\n**An identity is TRUE FOR ALL values** of the variables — that's why it beats an equation (true for some values only).\n\n_I do both directions: \"expand (a+b)²\" → a² + 2ab + b², and \"evaluate 103×97 using identity\"-style sums via BitMath!_"
    ] });

    /* ── CH 8 · polynomials ───────────────────────────────────────────────── */
    INTENTS.push({ tag: "m8_polynomials", patterns: [
        "what is a polynomial", "monomial binomial trinomial", "types of polynomials", "degree of a polynomial",
        "like and unlike terms", "coefficient of a term", "polynomial addition subtraction multiplication", "division of polynomials",
        "divide polynomial by monomial", "polynomial long division", "dividend divisor quotient remainder relation",
        "bahupad kya hota hai", "polynomial class 8"
    ], responses: [
        "📚 **Polynomials (Ch 8):**\n\nA **polynomial** = expression with variables having only WHOLE-number powers.\n- **Monomial** (1 term): 5x² · **Binomial** (2): 3x + 7 · **Trinomial** (3): x² + 2x + 1\n- **Degree** = highest power of the variable: degree of 4x³ − 2x⁵ + x is **5**\n- **Coefficient** = the number multiplying a term: in 7x²y the coefficient of x²y is 7\n- **Like terms** = same variable, same powers (3x² and −5x² ✔; 3x² and 3x ✘) — only like terms add up\n\n**Operations:**\n- Add/subtract → combine LIKE terms\n- Multiply → multiply coefficients, ADD powers: 2x² × 3x³ = 6x⁵; use distributive law for × binomials\n- **Divide by a monomial** → divide each term: (6x³ + 9x²) ÷ 3x = 2x² + 3x\n- **Divide by a polynomial** → long division, and always: **Dividend = Divisor × Quotient + Remainder** (degree of remainder < degree of divisor)\n\n_Try \"expand (x+3)(x-2) + 5\" or \"simplify 2x + 3x\" — BitMath does polynomial algebra exactly! ✏️_"
    ] });

    /* ── CH 9 · linear equations concept ─────────────────────────────────── */
    INTENTS.push({ tag: "m8_linear_eq", patterns: [
        "what is a linear equation in one variable", "linear equation definition", "solution of a linear equation",
        "transpose method", "transposing method linear equation", "cross multiplication method equation",
        "variables on both sides", "linear equation word problems types", "rekhik samikaran", "linear equation class 8 concept",
        "how to solve linear equations"
    ], responses: [
        "🎯 **Linear equations in one variable (Ch 9):**\n\n**Definition:** an equation whose highest power of the variable is **1**, like 2x + 3 = 11. Its graph is a straight LINE — hence 'linear'. It has exactly **ONE solution**.\n\n**Golden rule:** whatever you do to one side (add, subtract, multiply, divide), do the SAME to the other — the balance never breaks ⚖️\n\n**Solving techniques:**\n1. **Transposing** — move a term across '=' and flip its sign: 3x + 5 = 20 → 3x = 20 − 5 = 15 → x = 5 (× becomes ÷ when transposed)\n2. **Variables on both sides** — bring variable terms to LHS, numbers to RHS: 5x − 2 = 3x + 8 → 2x = 10 → x = 5\n3. **Cross-multiplication** — for x/a = b/c → cx = ab\n\n**Where they shine (word problems):** numbers, ages, speed–distance–time, perimeter/area, rupee-paise, ratios…\n\n_Just type any equation — \"2x + 3 = 11\", \"solve for x: 5x-2=3x+8\", even \"x²-5x+6=0\" — and I show EVERY step plus a verification check! ✅_"
    ] });

    /* ── CH 10 · parallel lines & transversal ─────────────────────────────── */
    INTENTS.push({ tag: "m8_parallel_lines", patterns: [
        "transversal meaning", "what is a transversal", "angles formed by transversal", "corresponding angles", "alternate interior angles",
        "alternate angles", "co-interior angles", "allied angles", "vertically opposite angles", "tests for parallelism",
        "conditions for parallel lines", "parallel lines cut by transversal properties", "transversal rekhikhanda", "corresponding angles axiom"
    ], responses: [
        "🛤️ **Parallel lines & a transversal (Ch 10):**\n\nA **transversal** = a line that cuts two or more lines at DIFFERENT points. When the two lines are PARALLEL, beautiful things happen:\n\n| Angle pair | Property |\n|---|---|\n| **Corresponding angles** (same corner at each crossing) | EQUAL ✂️ |\n| **Alternate interior angles** (Z-shape, inside, opposite sides) | EQUAL |\n| **Alternate exterior angles** | EQUAL |\n| **Co-interior / allied angles** (inside, same side — U-shape) | SUPPLEMENTARY (sum 180°) |\n| **Vertically opposite angles** (X-shape — ANY two crossing lines) | EQUAL |\n\n**Tests for parallelism** (the CONVERSES — if any holds, the lines ARE parallel):\n- corresponding angles equal, OR\n- alternate interior angles equal, OR\n- co-interior angles supplementary\n\n**Bonus:** through a point NOT on a line, exactly ONE parallel can be drawn; a line ∥ to one of two parallels is ∥ to the other.\n\n_Homework tip: hunt for the letters hidden in the diagram — **F** (corresponding), **Z** (alternate), **U/C** (co-interior), **X** (vertically opposite)! 🔍_"
    ] });

    /* ── CH 11 · quadrilaterals & polygons ───────────────────────────────── */
    INTENTS.push({ tag: "m8_quadrilaterals", patterns: [
        "quadrilateral properties class 8", "properties of parallelogram", "properties of rhombus", "properties of rectangle",
        "properties of square", "properties of trapezium", "properties of kite", "angle sum property of quadrilateral",
        "sum of interior angles of polygon", "exterior angle sum property", "regular polygon", "quadrilateral family tree",
        "chaturbhuj ke prakar", "parallelogram ke gun", "polygon angle sum formula"
    ], responses: [
        "🔷 **Quadrilaterals & polygons (Ch 11):**\n\n**Angle sum property:** sum of interior angles of an n-gon = **(n−2) × 180°** → quadrilateral = 360°, pentagon = 540°, hexagon = 720°\n**Exterior angles:** sum of exterior angles of ANY polygon = **360°** (always!). Regular n-gon → each exterior = 360°/n, each interior = 180° − 360°/n. Diagonals = n(n−3)/2.\n\n**The family (properties to memorise):**\n- **Parallelogram** — opposite sides equal & parallel · opposite angles equal · **diagonals BISECT each other**\n- **Rectangle** — parallelogram + all angles 90° · **diagonals equal** & bisect\n- **Rhombus** — parallelogram + all sides equal · diagonals bisect **at 90°** (and bisect the angles)\n- **Square** — rectangle + rhombus combined: all sides equal, all angles 90°, diagonals equal, bisect at 90°\n- **Trapezium** — exactly ONE pair of parallel sides (isosceles trapezium: non-parallel sides equal)\n- **Kite** — two pairs of ADJACENT equal sides · one diagonal is the perpendicular bisector of the other · one pair of opposite angles equal\n\nHierarchy: every square is a rectangle AND a rhombus AND a parallelogram — but NOT vice versa! 🏆\n\n_Ask: \"sum of interior angles of a hexagon\", \"each exterior angle of a regular polygon is 40 find sides\" — solved instantly!_"
    ] });

    /* ── CH 12 · construction of quadrilaterals ──────────────────────────── */
    INTENTS.push({ tag: "m8_construction", patterns: [
        "construction of quadrilaterals", "how to construct a quadrilateral", "parts needed to construct a quadrilateral",
        "construct quadrilateral given 4 sides and diagonal", "sssss construction", "cases of construction of quadrilateral",
        "quadrilateral kitne bhujao se banta hai", "construction class 8 chapter 12", "unique quadrilateral construction cases"
    ], responses: [
        "📐 **Construction of quadrilaterals (Ch 12):**\n\nA quadrilateral is drawn UNIQUELY when **any 5 of its parts** (sides, angles, diagonals) are given. The 4 standard cases:\n\n1. **Four sides + one diagonal** (e.g. SSSS + AC) — draw the diagonal first, then two triangles on it\n2. **Three sides + two diagonals** — build triangle with 3 known lengths, swing arcs for the rest\n3. **Two sides + three angles** — sum check: angles must satisfy the 360° property\n4. **Three sides + two included angles** — draw a side, construct the angles with a protractor, cut off the sides\n\n**General recipe:** ① rough sketch with measurements marked → ② draw the base element (side/diagonal) → ③ arcs/angles to locate vertices → ④ join & label.\n\n**Special shortcut:** for a PARALLELOGRAM only 3 parts suffice (2 adjacent sides + included angle) — because properties (opposite sides equal) supply the rest!\n\n_I can't swing your compass, but ask me \"properties of parallelogram\" or any mensuration sum and I've got the theory + numbers covered! ✏️_"
    ] });

    /* ── CH 13 · graphs & cartesian system ───────────────────────────────── */
    INTENTS.push({ tag: "m8_graphs", patterns: [
        "distance time graph", "speed from distance time graph", "types of graphs class 8",
        "line graph vs bar graph", "graph kaise banaye", "distance time graph slope",
        "straight line in distance time graph means", "horizontal line in distance time graph",
        "slope of distance time graph", "reading graphs class 8", "graphs chapter 13 class 8"
    ], responses: [
        "📈 **Graphs (Ch 13):**\n\n**Cartesian system:** two perpendicular number lines — horizontal **x-axis**, vertical **y-axis** — meeting at the **origin O(0,0)**. Every point = an ordered pair **(x, y)**: go x units sideways, then y units up/down.\n\n**Quadrant signs (anti-clockwise from top-right):**\n| Quadrant | Signs |\n|---|---|\n| I | (+, +) |\n| II | (−, +) |\n| III | (−, −) |\n| IV | (+, −) |\n\n**Plotting:** (3, 4) → 3 right, 4 up. (−2, 5) → quadrant II. (x, 0) lies ON the x-axis; (0, y) on the y-axis.\n\n**Distance–time graphs:**\n- Straight slanted line = **constant speed** · steeper line = **faster**\n- Horizontal line = **stationary** (time passes, distance doesn't)\n- **Speed = slope = (change in distance) ÷ (change in time)**\n- A curved line = changing speed\n\nOther types: **bar graph** (compare categories), **line graph** (change over time), **pie chart** (parts of a whole).\n\n_Ask me any plotting/coordinate doubt — or throw a speed-distance-time word problem at me! 🚀_"
    ] });

    /* ── CH 14 · mensuration formulas ─────────────────────────────────────── */
    INTENTS.push({ tag: "m8_mensuration", patterns: [
        "area of trapezium formula", "area of rhombus formula", "area of quadrilateral formula diagonal", "area of polygon by splitting",
        "surface area of cube cuboid cylinder", "volume of cube cuboid cylinder", "csa tsa formulas class 8",
        "mensuration formulas class 8", "1 litre equals how many cm cube", "kshetrafal aur aayatan ke sutra",
        "total surface area formula", "curved surface area cylinder"
    ], responses: [
        "📏 **Mensuration formula bank (Ch 14):**\n\n**Areas (2-D):**\n- Trapezium = **½ × (sum of parallel sides) × height** = ½(a+b)h\n- Rhombus = **½ × d₁ × d₂** (diagonals)\n- General quadrilateral = ½ × d × (h₁ + h₂) — diagonal d splits it, h₁,h₂ are perpendiculars from the other vertices\n- Any polygon → **split it into triangles/rectangles** and add the areas!\n\n**3-D solids:**\n| Solid | Volume | CSA/LSA | TSA |\n|---|---|---|---|\n| Cube (side a) | a³ | 4a² | 6a² |\n| Cuboid (l,b,h) | lbh | 2h(l+b) | 2(lb+bh+hl) |\n| Cylinder (r,h) | πr²h | 2πrh | 2πr(r+h) |\n\n**Capacity conversions:** 1 mL = 1 cm³ · **1 L = 1000 cm³** · 1 m³ = 1000 L\n\n_Try me: \"volume of a cylinder radius 7 height 10\", \"area of trapezium parallel sides 8 and 12 height 5\", \"TSA of cuboid 10 8 5\" — step by step! 🧊_"
    ] });

    /* ── CH 15 · statistics & probability concepts ───────────────────────── */
    INTENTS.push({ tag: "m8_statistics", patterns: [
        "grouped frequency distribution", "class interval meaning", "class width", "upper limit lower limit", "tally marks",
        "histogram vs bar graph", "how to draw a histogram", "pie chart angle formula", "central angle of pie chart",
        "raw data vs grouped data", "class mark", "statistics class 8", "aayata chitra", "pie chart kaise banaye"
    ], responses: [
        "📊 **Statistics & probability (Ch 15):**\n\n**Handling data:**\n- **Raw data** = unorganised observations → group it into **class intervals** like 0–10, 10–20 (upper limit excluded!)\n- **Class width/size** = upper − lower limit (10 above) · **Class mark** = (upper + lower)/2 → midpoint 15\n- **Tally marks** count frequencies in bundles of 5 (𝍸 = 4 + 1)\n\n**Histogram vs bar graph:**\n- **Bar graph:** bars SEPARATED, categories (discrete data), any order\n- **Histogram:** bars TOUCH each other, continuous class intervals, width = class size, height = frequency\n\n**Pie chart:** whole circle = total. **Central angle of a sector = (value ÷ total) × 360°**\n(e.g. 25% of students like cricket → sector angle = 90°)\n\n**Probability:** P(E) = favourable outcomes ÷ total outcomes — always between 0 (impossible) and 1 (certain).\nCoin: P(head) = ½ · Die: P(even) = 3/6 = ½ · Bag with 5 red 3 blue: P(red) = 5/8\n\n_Ask: \"probability of getting a prime on a die\" or \"average of first 20 natural numbers\" — computed exactly! 🎲_"
    ] });

    /* ── CH 16 · symmetry — enhance the EXISTING math_symmetry intent (data.js)
          with the full Class-8 rotational-syllabus depth instead of a twin ── */
    (function () {
        var sym = null;
        for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i].tag === 'math_symmetry') sym = INTENTS[i];
        if (!sym) return;
        var add = ["centre of rotation", "angle of rotation", "order of rotation", "rotational symmetry order formula",
            "figures with both symmetries", "which figures have both line and rotational symmetry",
            "letters with rotational symmetry", "letters with both symmetries", "does z have symmetry",
            "rotational symmetry of square rectangle circle", "ghurnan sammiti ki koti", "ghurnan kon",
            "symmetry of capital letters", "how to find order of rotational symmetry"];
        add.forEach(function (p) { if (sym.patterns.indexOf(p) === -1) sym.patterns.push(p); });
        sym.responses = [
            "🔄 **Symmetry — the full Class 8 picture (Ch 16):**\n\n**Line (reflection/mirror) symmetry** — fold the figure, both halves match exactly. The fold line = line of symmetry.\n- Equilateral triangle: **3** · Rectangle: **2** · Square: **4** · Circle: **infinite** ∞ · Isosceles triangle: 1 · Scalene triangle & parallelogram: **0**\n- Letters with line symmetry: A, H, I, M, O, T, U, V, W, X, Y (and B, C, D, E, K horizontally)\n\n**Rotational symmetry** — rotate the figure about a point; it looks EXACTLY the same more than once in a full turn.\n- **Centre of rotation** = the point you rotate about (usually the figure's centre)\n- **Angle of rotation** = smallest turn that maps the figure onto itself\n- **Order** = matching positions in 360° = **360° ÷ angle of rotation**\n\n| Figure | Order | Angle |\n|---|---|---|\n| Equilateral triangle | 3 | 120° |\n| Square | 4 | 90° |\n| Rectangle | 2 | 180° |\n| Regular hexagon | 6 | 60° |\n| Circle | infinite | any angle |\n\n**Both symmetries:** square, rectangle, circle, equilateral triangle, letters H, I, O, X.\n**Rotational only (order 2):** letters Z, N, S — no mirror line!\n\n_Order 1 = no rotational symmetry at all (like an isosceles trapezium). Test yourself: does 'P' have any symmetry? (None!)_",
            "🦋 **Symmetry in one breath:** mirror-line symmetry counts fold-matches (square = 4 lines, circle = infinite), rotational symmetry counts turn-matches — order = 360° ÷ smallest matching turn (square → 90° → order 4). Figures rocking BOTH: square, rectangle, circle, equilateral triangle, H·I·O·X. Rotation-only rebels: Z, N, S (order 2). Line symmetry = reflection; rotational = spin! 🔄"
        ];
    })();

    /* ── v10 self-description sync: keep "how smart are you" answers honest ── */
    (function () {
        var patched = 0;
        INTENTS.forEach(function (it) {
            it.responses = it.responses.map(function (r) {
                var n = r
                    .replace(/330 topics/g, '347 topics')
                    .replace(/330\+/g, '347+')
                    .replace(/79-lakh/g, '82-lakh')
                    .replace(/79 lakh/g, '82 lakh')
                    .replace(/79 LAKH/g, '82 LAKH')
                    .replace(/7\.9 million weights/g, '8.2 million weights');
                if (n !== r) patched++;
                return n;
            });
        });
        /* ── v10 miss-repair pass: phrasings the held-out test showed us ─────── */
    (function () {
        var REPAIR = {
            math_profit_loss: ["bought for 400 and sold for 500 find profit percent", "profit percent when cost and selling price are given", "find profit percentage from buying and selling price"],
            gk_days: ["teachers day date in india", "when do we celebrate teachers day"],
            site_offline_banner: ["offline banner meaning", "what does the offline message at top mean"],
            sci_lenses: ["how do spectacles correct vision", "spectacles help people see clearly how"],
            civics_amendments: ["which amendment added fundamental duties to the constitution", "amendment that inserted citizen duties"],
            ict_social: ["why do reels and short videos autoplay continuously", "short videos keep playing one after another why"],
            ict_cyberlaw: ["which law protects me if someone threatens me online", "online threat kaunsa law protect karta hai"],
            ict_gamedev: ["which engine was fortnite made in", "game engine used for fortnite", "unreal engine built games"],
            m8_linear_eq: ["solving equations by the transposing method", "how to transpose terms in an equation"],
            m8_square_props: ["which digits never appear at the end of a perfect square", "perfect square last digit rules", "can a perfect square end in 2 3 7 or 8"],
            m8_exponent_laws: ["what happens if the exponent is negative", "negative power meaning", "same base powers division rule", "divide powers with equal base"],
            m8_variation: ["in direct variation which ratio stays constant", "direct variation constant k", "more workers less days which variation"],
            m8_compound_int: ["half yearly compounding me rate aur time kaise change hote hain", "rate time change in half yearly compound interest"],
            m8_identities_use: ["multiply 98 and 102 using identity", "find the product without multiplying using identities", "use identity to multiply numbers"],
            m8_polynomials: ["find the degree of 4x cube minus 2x power 5", "degree of a polynomial expression", "highest degree term of a polynomial"],
            m8_quadrilaterals: ["which quadrilaterals have diagonals bisecting at 90 degrees", "diagonals bisect each other at right angles which figure"],
            m8_construction: ["minimum number of measurements to construct a quadrilateral", "how many parts are needed to draw a unique quadrilateral"]
        };
        var byTag = {}, added = 0;
        INTENTS.forEach(function (it) { byTag[it.tag] = it; });
        Object.keys(REPAIR).forEach(function (tag) {
            var it = byTag[tag];
            if (!it) { if (typeof console !== 'undefined') console.log('[data4] REPAIR TAG MISSING: ' + tag); return; }
            REPAIR[tag].forEach(function (p) {
                if (it.patterns.indexOf(p) === -1) { it.patterns.push(p); added++; }
            });
        });
        /* ── v10 miss-repair pass 2 (held-out 96.9% → pushing higher) ────────── */
    (function () {
        var REPAIR2 = {
            unread_red_dot: ["red circle badge on the friends button", "what does the red dot on friends mean"],
            sci_atom: ["protons and electrons kya hote hain", "particles inside an atom protons electrons neutrons"],
            math_mensuration: ["volume of cylinder formula", "what is the volume formula for a cylinder", "cylinder ka volume kaise nikale"],
            gk_currency: ["currency of united kingdom", "what is the currency used in britain", "uk currency name"],
            smalltalk_bored: ["i am bored what should i do now", "bored right now what to do"],
            site_invite: ["i received a friend invite how to respond", "friend invite aaya hai kya karun"],
            ict_history: ["who is called the father of the computer", "father of computer charles babbage name"],
            m8_commercial: ["igst full form and when it applies", "what is igst tax"],
            m8_quadrilaterals: ["sum of exterior angles of any polygon", "exterior angle sum of pentagon hexagon"]
        };
        var byTag = {}, added = 0;
        INTENTS.forEach(function (it) { byTag[it.tag] = it; });
        Object.keys(REPAIR2).forEach(function (tag) {
            var it = byTag[tag];
            if (!it) { if (typeof console !== 'undefined') console.log('[data4] REPAIR2 TAG MISSING: ' + tag); return; }
            REPAIR2[tag].forEach(function (p) {
                if (it.patterns.indexOf(p) === -1) { it.patterns.push(p); added++; }
            });
        });
        /* ── v10 miss-repair pass 3 (held-out 96.0% jitter pass) ─────────────── */
    (function () {
        var REPAIR3 = {
            sci_cells: ["cell kis cheez se bana hota hai", "what is a cell made up of"],
            sports_general: ["kabaddi game kya hai", "what is kabaddi about"],
            hist_freedom: ["jallianwala bagh incident kya tha", "jallianwala bagh massacre story"],
            sports_football: ["number of players in a football team on field", "football team me kitne player hote hain"],
            sports_athletics: ["length of a marathon race in km", "marathon kitne km ka hota hai"],
            smalltalk_love: ["i like a person in my class what to do", "crush on classmate what should i do"],
            site_rotate: ["why does the screen ask to rotate phone", "turn phone sideways message kyun aata hai"],
            sci_carbon: ["why is carbon a special element", "carbon ki visheshata kya hai"],
            civics_duties: ["duties of citizens towards the nation", "fundamental duties of a citizen list"],
            m8_sqrt_methods: ["square root by the division method", "long division square root steps", "division method to find square root"],
            hist_maratha: ["maratha samrajya ki sthapana kisne ki", "shivaji maratha empire founder"],
            hist_bihar: ["nalanda university kahan hai", "nalanda university location in bihar"],
            m8_identities_use: ["product of 98 and 102 using identity", "multiply numbers near 100 using identity"]
        };
        var byTag = {}, added = 0;
        INTENTS.forEach(function (it) { byTag[it.tag] = it; });
        Object.keys(REPAIR3).forEach(function (tag) {
            var it = byTag[tag];
            if (!it) { if (typeof console !== 'undefined') console.log('[data4] REPAIR3 TAG MISSING: ' + tag); return; }
            REPAIR3[tag].forEach(function (p) {
                if (it.patterns.indexOf(p) === -1) { it.patterns.push(p); added++; }
            });
        });
        if (typeof console !== 'undefined') console.log('[data4] miss-repair pass 3 added ' + added + ' patterns');
    })();

    if (typeof console !== 'undefined') console.log('[data4] miss-repair pass 2 added ' + added + ' patterns');
    })();

    if (typeof console !== 'undefined') console.log('[data4] miss-repair pass added ' + added + ' patterns');
    })();

    if (typeof console !== 'undefined') console.log('[data4] self-description sync: ' + patched + ' response patches');
    })();

    if (typeof console !== 'undefined') console.log('[data4] v10 class-8 mastery: 18 chapter intents loaded');

    if (typeof module !== 'undefined' && module.exports) module.exports = BitData;
    else root.BitData = BitData;
})(typeof window !== 'undefined' ? window : globalThis);
