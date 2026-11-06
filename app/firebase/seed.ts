import { doc, getDoc, writeBatch } from "firebase/firestore";
import { db, type NewRecipeInput } from "./data";

interface SeedReviewSpec {
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
}

interface SeedRecipeEntry {
  slug: string;
  likesCount: number;
  reviews: SeedReviewSpec[];
  recipe: NewRecipeInput;
}

// Firestore Security Rules cap cross-document `get()` evaluations at 20 per WriteBatch.
// Keeping engagement batches <= 12 ops guarantees every batch stays under that limit.
const ENGAGEMENT_BATCH_SIZE = 12;
const CONCURRENT_BATCHES = 6;

export const SEED_RECIPES: SeedRecipeEntry[] = [
  {
    slug: "apricot-cardamom-oat-crisp",
    likesCount: 9,
    reviews: [
      { rating: 5, text: "The cardamom in the oat topping makes the whole kitchen smell incredible." },
      { rating: 4, text: "Used slightly underripe apricots and it baked up jammy without turning mushy." },
      { rating: 5, text: "So good warm with vanilla bean ice cream." },
      { rating: 4, text: "Cut the brown sugar slightly and loved the tartness." },
    ],
    recipe: {
      title: "Apricot Cardamom Oat Crisp",
      ingredients: [
        "1 1/2 lbs fresh apricots, halved and sliced into wedges",
        "1/3 cup granulated sugar",
        "1 tbsp cornstarch",
        "1 tbsp fresh lemon juice",
        "1 tsp pure vanilla extract",
        "1 cup old-fashioned rolled oats",
        "1/2 cup all-purpose flour",
        "1/3 cup packed dark brown sugar",
        "3/4 tsp ground cardamom",
        "1/4 tsp fine sea salt",
        "6 tbsp cold unsalted butter, cubed",
      ],
      instructions: [
        {
          title: "Prepare the Baking Dish",
          content:
            "Position a rack in the center of the oven and preheat to 375°F (190°C). Lightly butter a 9-inch ceramic pie dish or 8-inch square baking pan.",
        },
        {
          title: "Macerate the Apricots",
          content:
            "Toss the sliced apricots with granulated sugar, cornstarch, lemon juice, and vanilla extract in a large bowl until no dry pockets of starch remain. Scrape the fruit and juices evenly into the prepared dish.",
        },
        {
          title: "Cut Together the Cardamom Streusel",
          content:
            "Whisk the rolled oats, flour, brown sugar, ground cardamom, and salt in a medium bowl. Work the cold butter cubes into the dry mixture with your fingertips until pea-sized clumps form.",
        },
        {
          title: "Bake Until Bubbling and Crisp",
          content:
            "Scatter the oat topping evenly over the apricots without pressing it down. Bake for 32 to 38 minutes until ruby juices bubble thickly around the edges and the oat crumble turns deep golden brown. Rest for 15 minutes before serving.",
        },
      ],
      tags: ["Dessert", "American", "Baking", "Vegetarian"],
      prepTime: "15 mins",
      cookTime: "35 mins",
      servings: "6",
    },
  },
  {
    slug: "baja-crispy-fish-tacos",
    likesCount: 15,
    reviews: [
      { rating: 5, text: "Seltzer in the batter stayed shatteringly crisp even under the slaw." },
      { rating: 5, text: "Best weeknight fish tacos I have made at home." },
      { rating: 5, text: "Chipotle lime crema goes on everything in our house now." },
      { rating: 4, text: "Worked great with Pacific cod cut into strips." },
      { rating: 5, text: "Restaurant quality!" },
    ],
    recipe: {
      title: "Baja Crispy Fish Tacos with Chipotle Crema",
      ingredients: [
        "1 lb skinless firm white fish (cod or mahi-mahi), cut into 1-inch strips",
        "3/4 cup all-purpose flour, plus 2 tbsp for dredging",
        "1/4 cup cornstarch",
        "1 tsp baking powder",
        "3/4 cup ice-cold sparkling water or Mexican lager",
        "1/2 cup Mexican crema or sour cream",
        "1 chipotle pepper in adobo, finely minced, plus 1 tsp adobo sauce",
        "2 limes, juiced and zested",
        "2 cups finely shredded purple cabbage",
        "1/4 cup fresh cilantro leaves, roughly chopped",
        "8 small corn tortillas, warmed",
        "Neutral high-heat oil, for shallow frying",
      ],
      instructions: [
        {
          title: "Whisk the Chipotle Crema and Slaw",
          content:
            "Stir together the crema, minced chipotle, adobo sauce, half the lime juice, and a pinch of salt in a small bowl. In a separate bowl, toss the shredded purple cabbage with the remaining lime juice, cilantro, and a pinch of salt.",
        },
        {
          title: "Mix the Cold Sparkling Batter",
          content:
            "Whisk 3/4 cup flour, cornstarch, baking powder, and 1/2 teaspoon salt in a medium bowl. Pour in the ice-cold sparkling water and whisk just until a light, slightly lumpy batter forms.",
        },
        {
          title: "Fry the Fish Until Golden",
          content:
            "Heat 1/2 inch of neutral oil in a heavy skillet to 365°F (185°C). Pat the fish strips dry, dust lightly with the reserved 2 tablespoons flour, dip into the cold batter, and fry in two batches for 3 to 4 minutes, turning once, until puffed and crisp. Drain on a wire rack.",
        },
        {
          title: "Assemble the Warm Tacos",
          content:
            "Tuck crispy fish strips into warm corn tortillas, pile bright lime cabbage slaw on top, and finish with a generous drizzle of smoky chipotle crema.",
        },
      ],
      tags: ["Mexican", "Seafood", "Quick & Easy"],
      prepTime: "20 mins",
      cookTime: "15 mins",
      servings: "4",
    },
  },
  {
    slug: "brown-butter-sage-gnocchi",
    likesCount: 13,
    reviews: [
      { rating: 5, text: "Pan-searing the gnocchi straight from the package instead of boiling is a game changer." },
      { rating: 4, text: "Crispy outside, pillowy inside, and ready in 15 minutes." },
      { rating: 5, text: "Toasted hazelnuts on top took it over the top." },
      { rating: 4, text: "Watch the butter closely so the milk solids toast instead of burn." },
    ],
    recipe: {
      title: "Brown Butter Sage Skillet Gnocchi",
      ingredients: [
        "1 lb shelf-stable or fresh potato gnocchi",
        "1 tbsp extra-virgin olive oil",
        "4 tbsp unsalted butter",
        "16 fresh sage leaves",
        "2 cloves garlic, thinly sliced",
        "1/3 cup finely grated Parmigiano-Reggiano, plus more to serve",
        "1/4 cup toasted hazelnuts or walnuts, coarsely chopped",
        "1 tsp fresh lemon juice",
        "Freshly cracked black pepper and flaky sea salt",
      ],
      instructions: [
        {
          title: "Crisp the Gnocchi in a Skillet",
          content:
            "Heat the olive oil in a wide 12-inch nonstick or cast-iron skillet over medium-high heat. Add the gnocchi in an uncrowded single layer—no boiling needed—and cook undisturbed for 3 minutes until golden underneath, then toss for 2 to 3 minutes more until blistered and tender inside. Transfer to a bowl.",
        },
        {
          title: "Infuse the Brown Butter with Sage",
          content:
            "Reduce the heat to medium and melt the butter in the same skillet. Swirl the pan as the butter foams; once golden specks begin to form, drop in the sage leaves and sliced garlic and sizzle for 45 seconds until the sage crisps and the butter smells nutty.",
        },
        {
          title: "Glaze and Toss",
          content:
            "Return the crispy gnocchi to the pan along with 2 tablespoons of water and the lemon juice. Toss vigorously for 30 seconds so the brown butter emulsifies into a glossy coating.",
        },
        {
          title: "Finish with Parmigiano and Hazelnuts",
          content:
            "Remove from the heat, fold in the grated Parmigiano-Reggiano and toasted hazelnuts, and season generously with cracked black pepper and flaky salt.",
        },
      ],
      tags: ["Italian", "Vegetarian", "Quick & Easy", "Pasta"],
      prepTime: "5 mins",
      cookTime: "12 mins",
      servings: "3",
    },
  },
  {
    slug: "charred-broccoli-cheddar-potatoes",
    likesCount: 6,
    reviews: [
      { rating: 3, text: "Tasty filling, though roasting the russets took closer to 70 minutes in my oven." },
      { rating: 4, text: "Charring the broccoli florets first gives way better flavor than steaming." },
      { rating: 3, text: "Solid comfort food side dish, needed a bit more sharp cheddar." },
    ],
    recipe: {
      title: "Charred Broccoli & Sharp Cheddar Twice-Baked Potatoes",
      ingredients: [
        "4 large russet potatoes (about 10 oz each), scrubbed dry",
        "2 tbsp olive oil, divided",
        "1 medium crown broccoli, chopped into tiny florets",
        "3 tbsp unsalted butter",
        "1/2 cup sour cream",
        "1/4 cup whole milk, warmed",
        "1 1/2 cups extra-sharp aged cheddar, freshly grated and divided",
        "3 scallions, thinly sliced",
        "1/2 tsp smoked paprika",
        "1 tsp kosher salt and 1/2 tsp black pepper",
      ],
      instructions: [
        {
          title: "Roast the Russet Potatoes",
          content:
            "Preheat the oven to 400°F (205°C). Prick the potatoes all over with a fork, rub the skins with 1 tablespoon olive oil and a pinch of salt, and bake directly on the middle rack for 55 to 60 minutes until easily pierced with a paring knife.",
        },
        {
          title: "Char the Broccoli Florets",
          content:
            "Spread the finely chopped broccoli florets on a sheet pan, toss with the remaining tablespoon of olive oil and a pinch of salt, and roast on the upper rack during the final 15 minutes of potato baking until the edges are frizzled and browned.",
        },
        {
          title: "Mash and Fold the Filling",
          content:
            "Slice the top third off each cooled-slightly potato and scoop the fluffy centers into a bowl, leaving a sturdy 1/4-inch shell. Mash the potato flesh with butter, sour cream, warm milk, smoked paprika, salt, and pepper, then fold in the charred broccoli, scallions, and 1 cup of cheddar.",
        },
        {
          title: "Mound and Broil",
          content:
            "Spoon the cheddar-broccoli mash back into the crispy potato shells, pile the remaining 1/2 cup cheddar on top, and bake for 15 minutes until bubbling and golden at the peaks.",
        },
      ],
      tags: ["American", "Vegetarian", "Comfort Food", "Gluten-Free"],
      prepTime: "20 mins",
      cookTime: "65 mins",
      servings: "4",
    },
  },
  {
    slug: "chili-crisp-dan-dan-noodles",
    likesCount: 17,
    reviews: [
      { rating: 5, text: "Numbing Sichuan peppercorn + nutty tahini + chili crisp hits every single note." },
      { rating: 5, text: "Better than our local noodle spot and comes together in 20 minutes." },
      { rating: 5, text: "Subbed shiitake mushrooms for a vegetarian guest and everyone went back for seconds." },
      { rating: 5, text: "Save extra noodle cooking water—it makes the sesame sauce cling like silk." },
      { rating: 4, text: "Spicy! Cut the chili crisp in half if cooking for kids." },
      { rating: 5, text: "Instant staple." },
    ],
    recipe: {
      title: "Chili Crisp Sesame Dan Dan Noodles",
      ingredients: [
        "12 oz fresh Chinese wheat noodles or dried ramen noodles",
        "8 oz ground pork (or crumbled firm shiitake mushrooms)",
        "1 tbsp neutral oil",
        "2 tbsp sweet soy sauce or regular soy sauce, divided",
        "1 tbsp Shaoxing rice wine or dry sherry",
        "3 cloves garlic, finely grated",
        "1 tbsp fresh ginger, finely grated",
        "3 tbsp Chinese sesame paste or well-stirred tahini",
        "2 1/2 tbsp spicy chili crisp, plus extra for topping",
        "1 tbsp Chinkiang black vinegar",
        "1/2 tsp freshly ground toasted Sichuan peppercorns",
        "4 baby bok choy, halved lengthwise",
        "2 scallions and 2 tbsp roasted peanuts, chopped",
      ],
      instructions: [
        {
          title: "Whisk the Numbing Sesame Sauce",
          content:
            "Combine the sesame paste, chili crisp, black vinegar, 1 tablespoon soy sauce, grated garlic, Sichuan peppercorn powder, and 3 tablespoons warm water in a serving bowl until smooth and pourable.",
        },
        {
          title: "Crisp the Savory Pork Topping",
          content:
            "Heat the oil in a wok or skillet over high heat. Add the ground pork, breaking it into tiny crumbles, and cook undisturbed for 3 minutes until deeply browned underneath. Stir in the ginger, Shaoxing wine, and remaining 1 tablespoon soy sauce, cooking 1 minute more until glazed and crispy.",
        },
        {
          title: "Boil the Noodles and Bok Choy",
          content:
            "Cook the wheat noodles in a pot of salted boiling water until al dente, dropping the halved bok choy into the water for the final 90 seconds. Reserve 1/3 cup starchy noodle water before draining.",
        },
        {
          title: "Toss and Crown the Bowls",
          content:
            "Loosen the sesame chili sauce with 2 to 3 tablespoons of hot noodle water, add the drained noodles, and toss vigorously to coat. Divide into bowls alongside the bok choy and pile the crispy pork, peanuts, scallions, and an extra spoonful of chili crisp on top.",
        },
      ],
      tags: ["Asian", "Noodles", "Quick & Easy", "Spicy"],
      prepTime: "10 mins",
      cookTime: "12 mins",
      servings: "4",
    },
  },
  {
    slug: "coconut-lime-red-lentil-dal",
    likesCount: 14,
    reviews: [
      { rating: 5, text: "Blooming the mustard seeds and chilies at the end transforms humble pantry lentils." },
      { rating: 5, text: "Creamy, bright from the lime, and freezes beautifully for lunches." },
      { rating: 5, text: "Made this three weeks in a row already." },
      { rating: 5, text: "Pure comfort in one pot." },
    ],
    recipe: {
      title: "Coconut Lime Red Lentil Dal with Tadka",
      ingredients: [
        "1 1/2 cups split red lentils (masoor dal), rinsed until clear",
        "1 tbsp coconut oil, plus 1 1/2 tbsp for the tadka",
        "1 yellow onion, finely diced",
        "4 cloves garlic, minced",
        "1 tbsp fresh ginger, finely grated",
        "1 tsp ground turmeric",
        "1 tsp ground coriander",
        "1 can (13.5 oz) full-fat coconut milk",
        "3 cups vegetable broth",
        "1 tsp brown mustard seeds and 1 tsp cumin seeds",
        "2 dried Kashmiri chilies or pinch red pepper flakes",
        "3 cups baby spinach and juice of 1 juicy lime",
      ],
      instructions: [
        {
          title: "Sauté the Aromatics",
          content:
            "Warm 1 tablespoon coconut oil in a Dutch oven over medium heat. Cook the diced onion with a pinch of salt for 7 minutes until translucent and golden at the edges, then stir in the garlic, ginger, turmeric, and ground coriander for 1 minute until fragrant.",
        },
        {
          title: "Simmer the Red Lentils",
          content:
            "Add the rinsed red lentils, vegetable broth, coconut milk, and 1 teaspoon salt. Bring to a boil, immediately lower the heat to a gentle simmer, and cook uncovered for 18 to 20 minutes, stirring occasionally, until the lentils collapse into a velvety stew.",
        },
        {
          title: "Wilt the Greens and Brighten",
          content:
            "Fold the baby spinach into the hot dal until wilted, then stir in the fresh lime juice and adjust salt to taste.",
        },
        {
          title: "Sizzle the Spiced Tadka",
          content:
            "Heat the remaining 1 1/2 tablespoons coconut oil in a small skillet over medium-high heat. Add the mustard seeds, cumin seeds, and dried chilies; as soon as the seeds pop and dance (about 30 seconds), pour the sizzling spiced oil directly over the pot of dal and serve with rice or naan.",
        },
      ],
      tags: ["Indian", "Vegan", "Vegetarian", "Gluten-Free", "One-Pot"],
      prepTime: "10 mins",
      cookTime: "25 mins",
      servings: "4",
    },
  },
  {
    slug: "crispy-gochujang-tofu-bowls",
    likesCount: 12,
    reviews: [
      { rating: 5, text: "Tearing the tofu into craggy chunks holds twice as much sticky gochujang glaze!" },
      { rating: 4, text: "Quick pickled cucumbers balance the sweet heat nicely." },
      { rating: 5, text: "Even my tofu-skeptic partner asked for this again." },
      { rating: 4, text: "Baked at 425°F on convection instead of pan-frying and it came out super crisp." },
    ],
    recipe: {
      title: "Crispy Gochujang Tofu & Pickled Cucumber Bowls",
      ingredients: [
        "14 oz extra-firm tofu, pressed dry for 15 minutes",
        "3 tbsp cornstarch",
        "2 tbsp neutral oil",
        "2 1/2 tbsp gochujang (Korean fermented chili paste)",
        "1 1/2 tbsp maple syrup or honey",
        "1 1/2 tbsp low-sodium soy sauce",
        "1 tbsp toasted sesame oil",
        "2 tbsp rice vinegar, divided",
        "1 Persian or English cucumber, thinly sliced",
        "3 cups steamed short-grain rice",
        "Toasted sesame seeds and sliced scallions, for garnish",
      ],
      instructions: [
        {
          title: "Quick-Pickle the Cucumbers",
          content:
            "Toss the thinly sliced cucumbers in a bowl with 1 tablespoon rice vinegar, 1/2 teaspoon sugar, and 1/4 teaspoon salt. Set aside to crisp and lightly pickle while you cook the tofu.",
        },
        {
          title: "Tear and Coat the Tofu",
          content:
            "Break the pressed tofu by hand into bite-sized craggy nuggets so the rough edges catch extra glaze. Toss gently in a large bowl with cornstarch and a pinch of salt until evenly dusted.",
        },
        {
          title: "Sear Until Golden and Craggy",
          content:
            "Heat the neutral oil in a large nonstick skillet over medium-high heat. Add the tofu pieces in a single layer and sear for 7 to 9 minutes, turning occasionally, until crisp and golden on all sides.",
        },
        {
          title: "Glaze and Build the Bowls",
          content:
            "Whisk together the gochujang, maple syrup, soy sauce, sesame oil, remaining 1 tablespoon rice vinegar, and 2 tablespoons water. Turn the heat to low, pour the sauce over the tofu, and toss for 60 seconds until glossy and sticky. Spoon over warm rice alongside the drained cucumbers, sesame seeds, and scallions.",
        },
      ],
      tags: ["Asian", "Vegan", "Vegetarian", "Quick & Easy"],
      prepTime: "15 mins",
      cookTime: "12 mins",
      servings: "3",
    },
  },
  {
    slug: "espresso-banana-tiramisu",
    likesCount: 11,
    reviews: [
      { rating: 5, text: "Ripe banana and dark espresso belong together—lighter than classic tiramisù too." },
      { rating: 4, text: "Definitely chill it overnight so the savoiardi slice cleanly." },
      { rating: 5, text: "Huge crowd-pleaser at dinner parties." },
    ],
    recipe: {
      title: "Espresso Banana Mascarpone Tiramisù",
      ingredients: [
        "3 ripe but firm bananas, sliced into 1/4-inch coins",
        "8 oz (225 g) mascarpone cheese, softened at room temperature",
        "1 cup cold heavy whipping cream",
        "1/3 cup powdered sugar",
        "1 tsp pure vanilla bean paste",
        "1 cup freshly brewed strong espresso, cooled completely",
        "2 tbsp dark rum or coffee liqueur (optional)",
        "24 crisp Italian ladyfingers (savoiardi)",
        "2 tbsp Dutch-process cocoa powder, for dusting",
      ],
      instructions: [
        {
          title: "Whip the Mascarpone Cloud Cream",
          content:
            "Beat the cold heavy cream, powdered sugar, and vanilla bean paste in a chilled bowl to medium peaks. Gently fold the room-temperature mascarpone into the whipped cream with a flexible spatula until smooth, thick, and billowy.",
        },
        {
          title: "Prepare the Espresso Dip",
          content:
            "Stir the cooled espresso and dark rum together in a shallow pie plate.",
        },
        {
          title: "Layer Cookies, Cream, and Bananas",
          content:
            "Dip half of the ladyfingers into the espresso for just 1 second per side and arrange snugly across an 8-inch square dish. Spread half of the mascarpone cream over the cookies, top with an even layer of sliced bananas, and repeat with the remaining dipped ladyfingers, bananas, and cream.",
        },
        {
          title: "Chill and Dust with Cocoa",
          content:
            "Cover tightly and refrigerate for at least 6 hours or overnight until the cookies soften into cake-like layers. Sift Dutch-process cocoa generously over the top right before serving.",
        },
      ],
      tags: ["Italian", "Dessert", "No-Bake", "Vegetarian"],
      prepTime: "25 mins",
      cookTime: "5 mins",
      servings: "8",
    },
  },
  {
    slug: "garlic-herb-butter-steak-bites",
    likesCount: 10,
    reviews: [
      { rating: 4, text: "Par-cooking the baby potatoes first guarantees everything finishes tender at the same time." },
      { rating: 4, text: "Great sear in cast iron—let the skillet get smoking hot before dropping the sirloin." },
      { rating: 3, text: "Cut my potatoes a bit too big so they needed extra time, otherwise delicious." },
      { rating: 4, text: "Fast, hearty weeknight dinner." },
    ],
    recipe: {
      title: "Garlic Herb Butter Steak Bites & Crispy Potatoes",
      ingredients: [
        "1 1/4 lbs top sirloin or New York strip steak, cut into 1 1/4-inch cubes",
        "1 lb baby Yukon Gold potatoes, halved (or quartered if large)",
        "2 tbsp neutral high-heat oil, divided",
        "3 tbsp unsalted butter",
        "4 cloves garlic, smashed and minced",
        "1 tbsp fresh rosemary and thyme leaves, finely chopped",
        "2 tbsp fresh flat-leaf parsley, chopped",
        "1 1/2 tsp kosher salt and 1 tsp cracked black pepper",
      ],
      instructions: [
        {
          title: "Crisp the Baby Potatoes",
          content:
            "Place the halved potatoes in a microwave-safe bowl with 2 tablespoons water, cover, and microwave for 4 minutes to jump-start cooking, then pat dry. Heat 1 tablespoon oil in a 12-inch cast-iron skillet over medium-high heat and sear the potatoes cut-side down for 6 to 8 minutes until deeply golden and crisp. Transfer to a plate.",
        },
        {
          title: "Sear the Seasoned Steak Cubes",
          content:
            "Pat the steak cubes bone-dry with paper towels and season generously with kosher salt and black pepper. Add the remaining 1 tablespoon oil to the ripping-hot skillet, arrange the steak in a single uncrowded layer, and sear undisturbed for 2 minutes until crusted underneath before tossing for 1 minute more.",
        },
        {
          title: "Baste with Garlic Herb Butter",
          content:
            "Lower the heat to medium-low and drop in the butter, minced garlic, rosemary, and thyme. As the butter foams, return the crispy potatoes to the pan and toss for 45 seconds until coated in fragrant garlic butter.",
        },
        {
          title: "Garnish and Serve Immediately",
          content:
            "Remove from the heat right away so the steak stays medium-rare, shower with fresh chopped parsley, and serve straight from the skillet.",
        },
      ],
      tags: ["American", "Gluten-Free", "Quick & Easy"],
      prepTime: "15 mins",
      cookTime: "18 mins",
      servings: "4",
    },
  },
  {
    slug: "golden-turmeric-chicken-rice-soup",
    likesCount: 8,
    reviews: [
      { rating: 5, text: "Like classic chicken soup leveled up with ginger, turmeric, and lots of fresh dill." },
      { rating: 4, text: "Saved us during cold season. Squeeze extra lemon at the table!" },
      { rating: 4, text: "Boneless thighs keep the meat super juicy." },
    ],
    recipe: {
      title: "Golden Turmeric & Ginger Chicken Rice Soup",
      ingredients: [
        "1 1/2 lbs boneless, skinless chicken thighs",
        "2 tbsp extra-virgin olive oil",
        "1 large yellow onion, diced",
        "3 carrots and 3 celery stalks, sliced into half-moons",
        "4 cloves garlic, thinly sliced",
        "1 tbsp fresh ginger, finely grated",
        "1 tsp ground turmeric and 1/2 tsp ground cumin",
        "6 cups low-sodium chicken stock",
        "2/3 cup jasmine rice, rinsed",
        "1/2 cup fresh dill and parsley, chopped",
        "Juice of 1 lemon",
      ],
      instructions: [
        {
          title: "Sweat the Vegetables and Spices",
          content:
            "Warm the olive oil in a heavy soup pot over medium heat. Sauté the onion, carrots, and celery with 1 teaspoon kosher salt for 8 minutes until softened, then stir in the sliced garlic, grated ginger, turmeric, and cumin for 1 minute until golden and aromatic.",
        },
        {
          title: "Poach the Chicken Thighs",
          content:
            "Nestle the whole chicken thighs into the pot and pour in the chicken stock. Bring to a gentle boil, reduce the heat to low, cover partially, and simmer for 15 minutes.",
        },
        {
          title: "Cook the Jasmine Rice",
          content:
            "Transfer the poached chicken to a cutting board to shred with two forks. Stir the rinsed jasmine rice into the simmering golden broth and cook for 12 minutes until tender.",
        },
        {
          title: "Return Chicken and Finish Brightly",
          content:
            "Slide the shredded chicken back into the pot along with the fresh lemon juice, dill, and parsley. Taste for salt and ladle into warm bowls.",
        },
      ],
      tags: ["Mediterranean", "Gluten-Free", "Comfort Food", "One-Pot"],
      prepTime: "15 mins",
      cookTime: "30 mins",
      servings: "6",
    },
  },
  {
    slug: "honey-harissa-sheet-pan-salmon",
    likesCount: 18,
    reviews: [
      { rating: 5, text: "Crispy spiced chickpeas + buttery caramelized salmon on a single pan—minimal dishes!" },
      { rating: 5, text: "That garlicky herb yogurt underneath ties the whole plate together." },
      { rating: 5, text: "Our #1 weeknight company dinner." },
      { rating: 5, text: "Works equally well with arctic char or steelhead trout." },
      { rating: 5, text: "Perfection." },
    ],
    recipe: {
      title: "Honey Harissa Sheet-Pan Salmon & Crispy Chickpeas",
      ingredients: [
        "4 center-cut salmon fillets (6 oz each), patted dry",
        "1 can (15 oz) chickpeas, rinsed and thoroughly dried",
        "1 pint cherry tomatoes",
        "2 tbsp olive oil",
        "2 1/2 tbsp rose or mild harissa paste",
        "1 1/2 tbsp runny honey",
        "1 tsp ground cumin",
        "3/4 cup plain Greek yogurt",
        "1 small clove garlic, finely grated",
        "1/3 cup fresh mint and cilantro leaves, torn",
        "1 lemon, half juiced and half cut into wedges",
      ],
      instructions: [
        {
          title: "Roast the Chickpeas and Tomatoes First",
          content:
            "Preheat the oven to 425°F (220°C). On a rimmed sheet pan, toss the dried chickpeas and cherry tomatoes with olive oil, ground cumin, 1/2 teaspoon salt, and black pepper. Roast for 15 minutes until the chickpeas start crisping and the tomatoes blister.",
        },
        {
          title: "Brush the Salmon with Honey Harissa",
          content:
            "Stir together the harissa paste, honey, and 1 teaspoon lemon juice in a small bowl. Season the salmon fillets lightly with salt.",
        },
        {
          title: "Roast the Salmon Alongside",
          content:
            "Push the chickpeas and tomatoes to the edges of the hot sheet pan, place the salmon fillets skin-side down in the center, and brush generously with the honey-harissa glaze. Return to the oven for 10 to 12 minutes until the salmon flakes easily and caramelizes at the edges.",
        },
        {
          title: "Swirl Yogurt and Plate",
          content:
            "Stir the Greek yogurt with grated garlic, remaining lemon juice, and a pinch of salt. Swoosh the cool yogurt across warm plates, top with salmon, blistered tomatoes, and crunchy chickpeas, and scatter with torn mint and cilantro.",
        },
      ],
      tags: ["Mediterranean", "Seafood", "Gluten-Free", "Quick & Easy"],
      prepTime: "10 mins",
      cookTime: "27 mins",
      servings: "4",
    },
  },
  {
    slug: "lemon-ricotta-blueberry-pancakes",
    likesCount: 7,
    reviews: [
      { rating: 5, text: "Custardy inside like a soufflé without having to whip egg whites separately." },
      { rating: 4, text: "Rubbing the lemon zest directly into the sugar makes the citrus pop." },
      { rating: 5, text: "Weekend brunch favorite!" },
    ],
    recipe: {
      title: "Cloud-Light Lemon Ricotta Blueberry Pancakes",
      ingredients: [
        "1 cup whole-milk ricotta cheese",
        "3/4 cup buttermilk or whole milk",
        "3 large eggs",
        "3 tbsp granulated sugar",
        "Zest of 2 organic lemons and 2 tbsp fresh lemon juice",
        "1 cup all-purpose flour",
        "1 1/2 tsp baking powder and 1/4 tsp baking soda",
        "1/4 tsp fine sea salt",
        "1 cup fresh blueberries",
        "2 tbsp melted unsalted butter, plus more for the griddle",
        "Warm pure maple syrup, to serve",
      ],
      instructions: [
        {
          title: "Infuse the Lemon Sugar and Wet Base",
          content:
            "Rub the lemon zest into the granulated sugar in a large bowl with your fingertips until fragrant and pale yellow. Whisk in the ricotta, buttermilk, eggs, lemon juice, and melted butter until smooth.",
        },
        {
          title: "Fold Dry Ingredients Gently",
          content:
            "Sift the flour, baking powder, baking soda, and salt directly over the ricotta mixture. Fold gently with a spatula just until combined—leaving small lumps ensures tender pancakes.",
        },
        {
          title: "Dot with Blueberries on the Griddle",
          content:
            "Heat a nonstick skillet or griddle over medium-low heat and brush lightly with butter. Ladle 1/4-cup portions of batter onto the pan and immediately press a scattering of fresh blueberries into the tops so they don't burn against the pan first.",
        },
        {
          title: "Flip Low and Slow",
          content:
            "Cook for 3 minutes until bubbles set around the edges and the bottoms turn golden, then flip carefully and cook 2 minutes more until puffed and cooked through. Serve warm with maple syrup.",
        },
      ],
      tags: ["American", "Breakfast", "Vegetarian"],
      prepTime: "12 mins",
      cookTime: "15 mins",
      servings: "4",
    },
  },
  {
    slug: "miso-maple-glazed-eggplant-soba",
    likesCount: 4,
    reviews: [
      { rating: 3, text: "Loved the miso eggplant; rinse the buckwheat soba well in cold water or they clump." },
      { rating: 2, text: "My globe eggplant took much longer to soften than Japanese eggplant." },
      { rating: 3, text: "Good flavor profile, definitely seek out slender Japanese eggplants." },
    ],
    recipe: {
      title: "Miso Maple Glazed Eggplant & Sesame Soba",
      ingredients: [
        "3 slender Japanese eggplants, halved lengthwise and scored in a crosshatch",
        "2 tbsp neutral oil",
        "3 tbsp white (shiro) miso paste",
        "2 tbsp pure maple syrup",
        "1 tbsp mirin and 1 tbsp rice vinegar",
        "1 tsp toasted sesame oil",
        "8 oz dried buckwheat soba noodles",
        "1 cup shelled edamame, thawed",
        "2 scallions, thinly sliced on a bias",
        "1 tbsp toasted white and black sesame seeds",
      ],
      instructions: [
        {
          title: "Whisk the Savory Miso Glaze",
          content:
            "Preheat the broiler with a rack 6 inches below the element. Whisk together the white miso, maple syrup, mirin, rice vinegar, sesame oil, and 1 tablespoon warm water until glossy.",
        },
        {
          title: "Sear and Broil the Scored Eggplant",
          content:
            "Brush the cut sides of the eggplants with oil and sear cut-side down in an ovenproof skillet or on a preheated sheet pan at 425°F for 12 minutes until custardy-soft. Flip cut-side up, spoon two-thirds of the miso glaze into the scored crevices, and broil for 3 to 4 minutes until bubbling and caramelized.",
        },
        {
          title: "Boil and Rinse the Soba",
          content:
            "Cook the soba noodles in unsalted boiling water for 4 to 5 minutes, adding the edamame for the final minute. Drain and rinse thoroughly under cool running water to wash away excess starch so the noodles stay springy.",
        },
        {
          title: "Toss and Plate",
          content:
            "Toss the soba and edamame with the reserved third of miso dressing, divide into bowls, and lay the caramelized eggplant halves on top with scallions and sesame seeds.",
        },
      ],
      tags: ["Asian", "Vegan", "Vegetarian", "Noodles"],
      prepTime: "15 mins",
      cookTime: "20 mins",
      servings: "3",
    },
  },
  {
    slug: "sweet-potato-black-bean-enchiladas",
    likesCount: 8,
    reviews: [
      { rating: 4, text: "Smoky roasted sweet potato with tangy queso fresco is such a great combo." },
      { rating: 5, text: "Great make-ahead vegetarian casserole." },
      { rating: 4, text: "Warm the corn tortillas briefly in sauce first so they roll without cracking." },
    ],
    recipe: {
      title: "Roasted Sweet Potato & Black Bean Enchiladas",
      ingredients: [
        "1 large sweet potato (12 oz), peeled and cut into 1/2-inch cubes",
        "2 tbsp olive oil",
        "1 tsp ground cumin and 1/2 tsp chili powder",
        "1 can (15 oz) black beans, rinsed and drained",
        "2 cups red guajillo enchilada sauce",
        "10 corn tortillas",
        "2 cups Oaxaca or Monterey Jack cheese, shredded",
        "1/3 cup crumbled queso fresco",
        "1 ripe avocado, sliced, and fresh cilantro leaves",
      ],
      instructions: [
        {
          title: "Roast the Spiced Sweet Potatoes",
          content:
            "Preheat the oven to 400°F (205°C). Toss the cubed sweet potatoes on a baking sheet with olive oil, cumin, chili powder, and 1/2 teaspoon salt, then roast for 22 minutes until tender and caramelized at the corners. Toss in a bowl with the black beans and 1/2 cup shredded Oaxaca cheese.",
        },
        {
          title: "Sauce the Dish and Soften Tortillas",
          content:
            "Spread 1/2 cup enchilada sauce across the bottom of a 9x13-inch baking dish. Warm the corn tortillas wrapped in a damp towel for 45 seconds so they bend pliably without splitting.",
        },
        {
          title: "Roll and Smother",
          content:
            "Spoon the sweet potato and black bean filling down the center of each tortilla, roll snugly, and line seam-side down in the dish. Pour the remaining enchilada sauce evenly over the top and scatter with the remaining Oaxaca cheese.",
        },
        {
          title: "Bake and Garnish Fresh",
          content:
            "Bake uncovered at 400°F for 18 to 20 minutes until the cheese melts and browns in spots. Top with crumbled queso fresco, sliced avocado, and fresh cilantro.",
        },
      ],
      tags: ["Mexican", "Vegetarian", "Gluten-Free", "Comfort Food"],
      prepTime: "20 mins",
      cookTime: "40 mins",
      servings: "5",
    },
  },
  {
    slug: "one-pan-sun-dried-tomato-orzo",
    likesCount: 5,
    reviews: [
      { rating: 4, text: "Toasting the dry orzo in the sun-dried tomato oil gives it risotto vibes in half the time." },
      { rating: 3, text: "Stir every couple minutes near the end so the orzo doesn't stick to the bottom." },
      { rating: 4, text: "Easy weeknight vegetarian dinner." },
    ],
    recipe: {
      title: "One-Pan Creamy Sun-Dried Tomato & Spinach Orzo",
      ingredients: [
        "1 1/4 cups dry orzo pasta",
        "1/2 cup oil-packed sun-dried tomatoes, thinly sliced, plus 2 tbsp jar oil",
        "1 small shallot, finely chopped",
        "3 cloves garlic, minced",
        "1/2 tsp crushed red pepper flakes",
        "2 3/4 cups vegetable or chicken broth",
        "1/2 cup heavy cream",
        "3 cups baby spinach",
        "1/2 cup freshly grated Parmesan cheese",
        "Handful of fresh basil leaves, torn",
      ],
      instructions: [
        {
          title: "Toast Aromatics and Dry Orzo",
          content:
            "Heat 2 tablespoons of aromatic oil from the sun-dried tomato jar in a deep skillet over medium heat. Cook the chopped shallot for 3 minutes until soft, then add the garlic, sliced sun-dried tomatoes, red pepper flakes, and dry orzo, stirring for 2 minutes until the pasta smells lightly toasted.",
        },
        {
          title: "Simmer Risotto-Style in One Pan",
          content:
            "Pour in the broth and bring to a lively simmer. Reduce the heat to medium-low and cook uncovered for 9 to 11 minutes, stirring every couple of minutes so the orzo doesn't catch, until tender and suspended in a starchy sauce.",
        },
        {
          title: "Fold in Cream, Spinach, and Parmesan",
          content:
            "Reduce the heat to low and stir in the heavy cream, Parmesan, and baby spinach for 1 to 2 minutes until the greens wilt and the sauce turns velvety.",
        },
        {
          title: "Shower with Fresh Basil",
          content:
            "Taste for salt and black pepper, scatter torn basil leaves across the skillet, and serve warm.",
        },
      ],
      tags: ["Italian", "Vegetarian", "Pasta", "One-Pot"],
      prepTime: "10 mins",
      cookTime: "15 mins",
      servings: "4",
    },
  },
  {
    slug: "papas-a-la-mexicana-tortillas",
    likesCount: 3,
    reviews: [
      { rating: 4, text: "Humble pantry ingredients that taste like Saturday morning in CDMX." },
      { rating: 4, text: "Great with fried eggs on top too." },
    ],
    recipe: {
      title: "Papas a la Mexicana with Warm Corn Tortillas",
      ingredients: [
        "1 1/2 lbs Yukon Gold potatoes, cut into 1/2-inch dice",
        "3 tbsp vegetable or olive oil",
        "1 medium white onion, diced",
        "2 jalapeño or serrano chilies, finely diced",
        "2 cloves garlic, minced",
        "4 ripe Roma tomatoes, chopped with their juices",
        "1/2 tsp dried Mexican oregano",
        "1/3 cup fresh cilantro, chopped",
        "1 tsp kosher salt",
        "Warm corn tortillas and crumbled cotija, to serve",
      ],
      instructions: [
        {
          title: "Brown the Diced Potatoes",
          content:
            "Heat the oil in a large heavy skillet over medium heat. Add the diced Yukon Gold potatoes in an even layer and cook for 10 to 12 minutes, flipping occasionally, until golden crusts form on the outside.",
        },
        {
          title: "Sauté Onion and Fresh Chilies",
          content:
            "Stir in the diced white onion and jalapeños and cook for 4 minutes until softened, then add the garlic and rub the dried Mexican oregano between your palms into the pan.",
        },
        {
          title: "Braise in Fresh Roma Tomatoes",
          content:
            "Add the chopped Roma tomatoes and kosher salt, scraping up any browned potato bits. Cover the skillet, lower the heat to medium-low, and simmer for 8 to 10 minutes until the tomatoes collapse into a rustic red sauce and the potatoes are fork-tender.",
        },
        {
          title: "Fold in Cilantro and Serve",
          content:
            "Uncover, fold in the fresh cilantro, and spoon into warm corn tortillas with a pinch of cotija.",
        },
      ],
      tags: ["Mexican", "Vegetarian", "Gluten-Free", "Breakfast"],
      prepTime: "15 mins",
      cookTime: "22 mins",
      servings: "4",
    },
  },
  {
    slug: "spiced-tomato-shakshuka-feta",
    likesCount: 1,
    reviews: [],
    recipe: {
      title: "Spiced Tomato Shakshuka with Feta & Za'atar Pita",
      ingredients: [
        "3 tbsp extra-virgin olive oil, divided",
        "1 red bell pepper, diced",
        "1 yellow onion, thinly sliced",
        "4 cloves garlic, minced",
        "1 1/2 tsp ground cumin and 1 tsp sweet paprika",
        "1/4 tsp cayenne pepper",
        "1 can (28 oz) whole peeled San Marzano tomatoes, crushed by hand",
        "6 large eggs",
        "1/2 cup tangy sheep's-milk feta, crumbled",
        "2 pocketless pita breads and 1 tbsp za'atar",
        "Fresh parsley and cilantro leaves",
      ],
      instructions: [
        {
          title: "Simmer the Spiced Pepper-Tomato Sauce",
          content:
            "Warm 2 tablespoons olive oil in a wide lidded skillet over medium heat. Cook the sliced onion and red bell pepper with 3/4 teaspoon salt for 10 minutes until sweet and jammy. Stir in the garlic, cumin, paprika, and cayenne for 45 seconds, then pour in the crushed tomatoes and simmer gently for 10 minutes until thickened.",
        },
        {
          title: "Toast the Za'atar Pita Wedges",
          content:
            "Brush the pita breads with the remaining 1 tablespoon olive oil, sprinkle with za'atar, and toast in a 375°F oven or toaster oven for 5 minutes until crisp at the edges, then cut into wedges.",
        },
        {
          title: "Poach the Eggs in Sauce Wells",
          content:
            "Make six shallow wells in the bubbling tomato sauce with the back of a spoon and crack an egg into each. Scatter the crumbled feta around the eggs, cover the skillet, and cook on low for 5 to 7 minutes until the whites are opaque while the yolks remain runny.",
        },
        {
          title: "Scatter Herbs and Scoop",
          content:
            "Top with fresh parsley and cilantro leaves and bring the skillet straight to the table with warm za'atar pita for dipping.",
        },
      ],
      tags: ["Mediterranean", "Vegetarian", "Breakfast", "One-Pot"],
      prepTime: "12 mins",
      cookTime: "25 mins",
      servings: "4",
    },
  },
  {
    slug: "smoky-chipotle-chicken-tinga-tostadas",
    likesCount: 2,
    reviews: [
      { rating: 2, text: "Way spicier than expected when using three whole chipotles!" },
      { rating: 3, text: "Dialed back to one chipotle pepper the second time and liked the balance much more." },
      { rating: 2, text: "Sauce reduced too fast—add an extra splash of stock." },
    ],
    recipe: {
      title: "Smoky Chipotle Chicken Tinga Tostadas",
      ingredients: [
        "1 1/2 lbs boneless, skinless chicken breasts or thighs",
        "1 can (14.5 oz) fire-roasted diced tomatoes",
        "2 chipotle peppers in adobo, plus 1 tbsp adobo sauce",
        "1 large white onion, halved (half blended, half thinly sliced)",
        "3 cloves garlic",
        "1/2 tsp dried Mexican oregano",
        "1 tbsp vegetable oil",
        "3/4 cup chicken broth",
        "8 crispy baked or fried corn tostada shells",
        "Refried black beans, shredded romaine, crema, and pickled red onions",
      ],
      instructions: [
        {
          title: "Poach and Shred the Chicken",
          content:
            "Simmer the chicken with 1 teaspoon salt in water to cover for 14 minutes until cooked through. Reserve 3/4 cup poaching broth and shred the warm chicken finely.",
        },
        {
          title: "Blend the Smoky Chipotle Tomato Base",
          content:
            "Purée the fire-roasted tomatoes, chipotles, adobo sauce, half the white onion, garlic, oregano, and reserved broth in a blender until completely smooth.",
        },
        {
          title: "Braise Onions and Shredded Chicken",
          content:
            "Sauté the thinly sliced remaining half onion in oil in a wide skillet for 5 minutes until translucent. Pour in the blended chipotle tomato sauce, simmer 6 minutes until darkened and thick, then fold in the shredded chicken to soak up the sauce.",
        },
        {
          title: "Stack the Crunchy Tostadas",
          content:
            "Swipe warm refried beans onto each tostada shell, pile smoky chicken tinga on top, and finish with crisp romaine, crema, and pickled red onions.",
        },
      ],
      tags: ["Mexican", "Gluten-Free", "Spicy"],
      prepTime: "15 mins",
      cookTime: "25 mins",
      servings: "4",
    },
  },
  {
    slug: "thai-holy-basil-pad-kra-pao",
    likesCount: 0,
    reviews: [],
    recipe: {
      title: "Street-Style Thai Holy Basil Stir-Fry (Pad Kra Pao)",
      ingredients: [
        "1 lb coarsely ground chicken thigh or pork",
        "4 Thai bird's eye chilies, bruised and finely chopped",
        "6 cloves garlic, roughly pounded",
        "3 tbsp neutral high-heat oil, divided",
        "4 large eggs",
        "1 1/2 tbsp oyster sauce",
        "1 tbsp fish sauce and 1 tsp dark soy sauce",
        "1 tsp palm or brown sugar",
        "1 1/2 cups packed fresh holy basil or Thai basil leaves",
        "Steamed jasmine rice, to serve",
      ],
      instructions: [
        {
          title: "Fry Lace-Edged Crispy Eggs",
          content:
            "Heat 2 tablespoons oil in a wok over high heat until shimmering. Crack in the eggs one or two at a time and baste the whites with hot oil for 60 to 90 seconds until the edges puff golden and lacy while the yolks stay jammy. Drain on a plate.",
        },
        {
          title: "Stir-Fry Garlic and Bird's Eye Chilies",
          content:
            "Pour off all but 1 tablespoon oil from the hot wok, toss in the pounded garlic and Thai chilies, and stir-fry for 20 seconds until fiercely aromatic.",
        },
        {
          title: "Sear the Ground Chicken",
          content:
            "Add the coarsely ground chicken, spreading it up the sides of the wok to sear for 3 to 4 minutes before breaking up into savory bite-sized clumps.",
        },
        {
          title: "Toss Sauce and Wilt Fresh Basil",
          content:
            "Splash in the oyster sauce, fish sauce, dark soy sauce, sugar, and 2 tablespoons water, tossing on high heat for 45 seconds. Kill the heat, fold in the fresh basil leaves until just wilted, and serve immediately beside jasmine rice and a crispy fried egg.",
        },
      ],
      tags: ["Asian", "Spicy", "Quick & Easy"],
      prepTime: "10 mins",
      cookTime: "10 mins",
      servings: "4",
    },
  },
  {
    slug: "warm-cinnamon-piloncillo-capirotada",
    likesCount: 2,
    reviews: [
      { rating: 2, text: "Used soft sandwich bread instead of crusty bolillo rolls and it turned too soggy." },
      { rating: 1, text: "Way too sweet for my taste when served warm." },
      { rating: 2, text: "Definitely toast the bread cubes dark first so they hold the spiced syrup." },
    ],
    recipe: {
      title: "Warm Cinnamon Piloncillo Bread Pudding (Capirotada)",
      ingredients: [
        "4 crusty bolillo rolls or 1 day-old French baguette, cut into 1-inch cubes",
        "3 tbsp melted unsalted butter",
        "8 oz grated piloncillo or 1 cup packed dark brown sugar",
        "2 cups water",
        "2 sticks Mexican canela (true cinnamon) and 3 whole cloves",
        "1 strip orange peel",
        "2 ripe plantains or firm bananas, sliced",
        "1/2 cup toasted pecans and 1/3 cup golden raisins",
        "1 cup aged cotija or mild cheddar cheese, cubed or crumbled",
      ],
      instructions: [
        {
          title: "Toast the Bolillo Cubes Crisp",
          content:
            "Preheat the oven to 350°F (175°C). Toss the cubed bolillo bread on a baking sheet with melted butter and bake for 12 to 15 minutes until dry and deeply golden so it holds its structure once soaked.",
        },
        {
          title: "Infuse the Spiced Piloncillo Syrup",
          content:
            "Simmer the piloncillo, water, canela sticks, cloves, and orange peel in a saucepan over medium heat for 10 minutes until dissolved and fragrant, then strain out the whole spices.",
        },
        {
          title: "Layer Bread, Fruit, Nuts, and Cheese",
          content:
            "Butter an 8-inch square baking dish and layer half of the toasted bread, sliced bananas, pecans, raisins, and savory cheese, then repeat with a second layer.",
        },
        {
          title: "Soak and Bake Until Golden",
          content:
            "Ladle the warm spiced syrup evenly over every corner of the bread, cover loosely with foil for 15 minutes, then uncover and bake 10 minutes more until bubbling and toasted on top.",
        },
      ],
      tags: ["Mexican", "Dessert", "Comfort Food", "Vegetarian"],
      prepTime: "15 mins",
      cookTime: "40 mins",
      servings: "6",
    },
  },
];

async function resolveSeedRecipeId(
  slug: string,
  userId: string
): Promise<string> {
  const defaultId = `seed-${slug}`;
  const existing = await getDoc(doc(db, "recipes", defaultId)).catch(() => null);
  if (!existing || !existing.exists() || existing.data()?.authorId === userId) {
    return defaultId;
  }
  const safeUidPrefix =
    userId
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 8) || "user";
  return `seed-${safeUidPrefix}-${slug}`;
}

/**
 * Seeds 20 sample recipes (with varied reviews and likes) from the browser
 * using the signed-in user's Firebase Auth context. Works identically against
 * production Firestore and the local Firebase Emulator Suite.
 */
export async function seedSampleRecipes(userId: string): Promise<number> {
  const resolvedIds = await Promise.all(
    SEED_RECIPES.map((entry) => resolveSeedRecipeId(entry.slug, userId))
  );

  // 1. Write all 20 recipe documents first so `exists` / `get` rules succeed on engagement writes
  const recipeBatch = writeBatch(db);
  SEED_RECIPES.forEach((entry, idx) => {
    const recipeId = resolvedIds[idx];
    recipeBatch.set(doc(db, "recipes", recipeId), {
      ...entry.recipe,
      authorId: userId,
    });
  });
  await recipeBatch.commit();

  // 2. Build review + like operations and commit in <= 12-op batches
  const engagementOps: Array<(batch: ReturnType<typeof writeBatch>) => void> =
    [];

  SEED_RECIPES.forEach((entry, idx) => {
    const recipeId = resolvedIds[idx];

    entry.reviews.forEach((review, rIdx) => {
      const reviewId = `seed-review-${String(rIdx + 1).padStart(2, "0")}`;
      engagementOps.push((batch) => {
        batch.set(doc(db, "recipes", recipeId, "reviews", reviewId), {
          recipeId,
          userId,
          rating: review.rating,
          text: review.text,
        });
      });
    });

    for (let lIdx = 0; lIdx < entry.likesCount; lIdx++) {
      const likeId = `${recipeId}_seed_like_${String(lIdx + 1).padStart(2, "0")}`;
      engagementOps.push((batch) => {
        batch.set(doc(db, "likes", likeId), {
          recipeId,
          userId,
        });
      });
    }
  });

  const batches: Array<ReturnType<typeof writeBatch>> = [];
  for (
    let offset = 0;
    offset < engagementOps.length;
    offset += ENGAGEMENT_BATCH_SIZE
  ) {
    const batch = writeBatch(db);
    for (const applyOp of engagementOps.slice(
      offset,
      offset + ENGAGEMENT_BATCH_SIZE
    )) {
      applyOp(batch);
    }
    batches.push(batch);
  }

  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    await Promise.all(
      batches.slice(i, i + CONCURRENT_BATCHES).map((b) => b.commit())
    );
  }

  return SEED_RECIPES.length;
}
