// WaxCompare's forum settings (the rules are in ./core.ts, docs/forum.md).
import type { ForumSite } from "./core";

export const FORUM_SITE: ForumSite = {
  site: "waxcompare",
  siteName: "WaxCompare",
  repo: "Specifxx/waxcompare",
  hosts: ["waxcompare.app", "www.waxcompare.app"],
  base: "/forum",
  topic: "sealed sports cards",
  intro: "Talk sealed sports card prices, new releases, hobby vs retail and what you're chasing with other collectors.",
  categories: [
    {
      "key": "new-releases",
      "name": "New release prices",
      "blurb": "Pre-orders, release week and how a new product's boxes are pricing.",
      "prompts": [
        "Is this release worth buying by the hobby box?",
        "Hobby or blaster: which is better value this year?"
      ]
    },
    {
      "key": "deals",
      "name": "Deals & where to buy",
      "blurb": "Good prices you spotted, shop experiences and shipping tips.",
      "prompts": [
        "Which shop shipped fastest for you?",
        "Best hobby box price you've seen this week"
      ]
    },
    {
      "key": "rips",
      "name": "Rips & pulls",
      "blurb": "What came out of your boxes, and whether it was worth it.",
      "prompts": [
        "Best pull from a blaster this year?",
        "Was your last hobby box worth it?"
      ]
    },
    {
      "key": "collection",
      "name": "Collection talk",
      "blurb": "Sealed collecting, opening vs holding, and what you're chasing.",
      "prompts": [
        "Open it or keep it sealed?",
        "Which releases do you think will hold value?"
      ]
    },
    {
      "key": "site",
      "name": "Site feedback",
      "blurb": "Ideas, bugs or a shop we should add.",
      "prompts": [
        "A shop we should compare"
      ]
    }
  ],
  reserved: ["waxcompare", "wax compare", "topps", "panini"],
};
