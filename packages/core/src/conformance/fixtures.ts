/**
 * THE CONFORMANCE FIXTURES — APPEND-ONLY. Written by
 * `node scripts/conformance-fixtures.mjs`, which only ever adds a fixture
 * whose id is new; an existing one changes only with an entry in
 * ANNOUNCED naming the version and what changed, and the lock
 * (packages/core/tests/conformance.lock.json) holds the rest still.
 */
import type { Operation } from "../ops/types.js";

export interface DocumentFixture {
  readonly id: string;
  /** The framework version that recorded it. */
  readonly since: string;
  readonly kind: "document";
  readonly document: unknown;
  readonly expect: { readonly compiles: boolean; readonly findings: readonly string[]; readonly tools: Readonly<Record<string, unknown>> };
}

export interface LogFixture {
  readonly id: string;
  readonly since: string;
  readonly kind: "log";
  /** The document fixture whose declaration the log is folded under. */
  readonly document: string;
  readonly ops: readonly Operation[];
  readonly expect: { readonly hash: string };
}

export type ConformanceFixture = DocumentFixture | LogFixture;

/** A difference made on purpose: the fixture, the version that made it, and what changed — recorded instead of editing the past in silence. */
export interface Announcement {
  readonly fixture: string;
  readonly version: string;
  readonly what: string;
}

export const ANNOUNCED: readonly Announcement[] = [
  {
    fixture: "document:vendors",
    version: "0.1.14",
    what: "FR-110: edit-category takes name — add-to-category makes a vendor named $name and no longer counts as writing the category's name — and edit-category and edit-vendor refuse an argument they do not take (additionalProperties: false).",
  },
  {
    fixture: "document:two-lines",
    version: "0.1.14",
    what: "FR-110: edit-chore refuses an argument it does not take (additionalProperties: false).",
  },
  {
    fixture: "document:vendors",
    version: "0.1.15",
    what: "FR-121: every act refuses an argument it does not take — add-category, add-vendor, add-to-category, set-quote, book, decline, file-under, unfile and remove-category and remove-vendor say additionalProperties: false.",
  },
  {
    fixture: "document:two-lines",
    version: "0.1.15",
    what: "FR-121: add-chore and remove-chore refuse an argument they do not take (additionalProperties: false).",
  },
];

export const FIXTURES: readonly ConformanceFixture[] = [
  {
    "id": "document:vendors",
    "since": "0.1.1",
    "kind": "document",
    "document": {
      "format": "graview-document",
      "formatVersion": 1,
      "name": "Wedding vendors",
      "description": "Who we're hiring, what they quoted, and who's booked.",
      "kinds": {
        "category": {
          "noun": "category",
          "plural": "categories",
          "description": "A kind of vendor we need one of.",
          "fields": {
            "name": {
              "type": "string",
              "required": true
            },
            "budget": {
              "type": "number",
              "format": "money"
            }
          }
        },
        "vendor": {
          "noun": "vendor",
          "plural": "vendors",
          "description": "Someone we might hire.",
          "fields": {
            "name": {
              "type": "string",
              "required": true
            },
            "status": {
              "type": "enum",
              "options": [
                "researching",
                "contacted",
                "booked",
                "declined"
              ],
              "default": "researching",
              "required": true
            },
            "quote": {
              "type": "number",
              "format": "money"
            },
            "due": {
              "type": "date",
              "description": "when they need an answer"
            },
            "notes": {
              "type": "text"
            }
          },
          "describe": "{status} · {quote|money}",
          "lifecycle": {
            "field": "status",
            "retired": [
              "declined"
            ]
          },
          "edges": {
            "fills": {
              "to": [
                "category"
              ],
              "cardinality": "one",
              "description": "the category it fills",
              "inverse": "vendors for it"
            }
          }
        }
      },
      "acts": {
        "add-category": {
          "title": "Add a category",
          "creates": "category",
          "description": "Start tracking a kind of vendor you need, optionally with a budget for it."
        },
        "add-vendor": {
          "title": "Add a vendor",
          "creates": "vendor",
          "description": "Add a vendor you are considering, before you know which category they fill."
        },
        "add-to-category": {
          "title": "Add a vendor to this category",
          "on": "category",
          "args": {
            "name": {
              "type": "string",
              "required": true
            }
          },
          "effects": [
            {
              "create": "vendor",
              "as": "new",
              "set": {
                "name": "$name"
              }
            },
            {
              "connect": "fills",
              "from": "$new",
              "to": "$subject"
            }
          ],
          "description": "Add a vendor you are considering for this category."
        },
        "set-quote": {
          "title": "Set the quote",
          "on": "vendor",
          "writes": [
            "quote"
          ],
          "description": "Record what a vendor quoted, in the app's currency."
        },
        "book": {
          "title": "Book",
          "on": "vendor",
          "sets": {
            "status": "booked"
          },
          "allowedWhen": "status != 'declined'",
          "refusal": "{name} was declined; reopen them first",
          "description": "Mark a vendor as booked once you have committed to them."
        },
        "decline": {
          "title": "Decline",
          "on": "vendor",
          "sets": {
            "status": "declined"
          },
          "description": "Mark a vendor as declined; they drop behind the horizon but are not deleted."
        },
        "file-under": {
          "title": "File under a category",
          "on": "vendor",
          "connects": "fills",
          "description": "Say which category a vendor is for.",
          "fromTheOtherEnd": "Add one of our vendors"
        },
        "unfile": {
          "title": "Take out of its category",
          "on": "vendor",
          "severs": "fills",
          "description": "Take a vendor out of the category they were filed under.",
          "fromTheOtherEnd": "Take a vendor out of this category"
        }
      },
      "rules": {
        "booked-needs-quote": {
          "title": "A booked vendor has a quote",
          "over": "vendor",
          "when": "status == 'booked'",
          "require": "quote != null",
          "says": "{name} is booked but has no quote",
          "repairs": [
            {
              "act": "set-quote",
              "label": "Add the quote"
            }
          ]
        },
        "one-booked-per-category": {
          "title": "One vendor booked per category",
          "over": "category",
          "require": "count(in('fills') where status == 'booked') <= 1",
          "says": "{name} has more than one vendor booked"
        },
        "within-budget": {
          "title": "Booked vendors fit the category's budget",
          "over": "category",
          "when": "present(budget)",
          "require": "sum(in('fills') where status == 'booked', 'quote') <= budget",
          "says": "{name} is over its {budget|money} budget"
        }
      },
      "roles": [
        "owner",
        "planner",
        "viewer"
      ],
      "policy": {
        "grants": [
          {
            "roles": [
              "owner",
              "planner"
            ],
            "mutations": "*"
          }
        ]
      },
      "brand": {
        "accent": "#a8456a"
      }
    },
    "expect": {
      "compiles": true,
      "findings": [
        "warning:role-may-do-nothing"
      ],
      "tools": {
        "add-category": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "name": {
              "type": "string",
              "maxLength": 500
            },
            "budget": {
              "type": "number"
            },
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Optional: the id for the category this makes. Refused if the graph already has it; left out, one is minted from the label."
            }
          },
          "required": [
            "name"
          ]
        },
        "add-vendor": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "name": {
              "type": "string",
              "maxLength": 500
            },
            "status": {
              "type": "string",
              "enum": [
                "researching",
                "contacted",
                "booked",
                "declined"
              ]
            },
            "quote": {
              "type": "number"
            },
            "due": {
              "type": "string",
              "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
              "description": "when they need an answer"
            },
            "notes": {
              "type": "string",
              "maxLength": 20000
            },
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Optional: the id for the vendor this makes. Refused if the graph already has it; left out, one is minted from the label."
            }
          },
          "required": [
            "name"
          ]
        },
        "add-to-category": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (category)."
            },
            "name": {
              "type": "string",
              "maxLength": 500
            }
          },
          "required": [
            "id",
            "name"
          ]
        },
        "set-quote": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            },
            "quote": {
              "type": "number"
            }
          },
          "required": [
            "id",
            "quote"
          ]
        },
        "book": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            }
          },
          "required": [
            "id"
          ]
        },
        "decline": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            }
          },
          "required": [
            "id"
          ]
        },
        "file-under": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            },
            "to": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (category)."
            }
          },
          "required": [
            "id",
            "to"
          ]
        },
        "unfile": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            },
            "to": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (category)."
            }
          },
          "required": [
            "id",
            "to"
          ]
        },
        "edit-category": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (category)."
            },
            "name": {
              "type": "string",
              "maxLength": 500
            },
            "budget": {
              "type": "number"
            }
          },
          "required": [
            "id"
          ]
        },
        "edit-vendor": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            },
            "name": {
              "type": "string",
              "maxLength": 500
            },
            "due": {
              "type": "string",
              "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
              "description": "when they need an answer"
            },
            "notes": {
              "type": "string",
              "maxLength": 20000
            }
          },
          "required": [
            "id"
          ]
        },
        "remove-category": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (category)."
            }
          },
          "required": [
            "id"
          ]
        },
        "remove-vendor": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (vendor)."
            }
          },
          "required": [
            "id"
          ]
        }
      }
    }
  },
  {
    "id": "document:two-lines",
    "since": "0.1.1",
    "kind": "document",
    "document": {
      "format": "graview-document",
      "formatVersion": 1,
      "name": "Chores",
      "kinds": {
        "chore": {
          "fields": {
            "title": {
              "type": "string",
              "required": true
            },
            "done": {
              "type": "boolean"
            }
          }
        }
      },
      "acts": {
        "add-chore": {
          "title": "Add a chore",
          "creates": "chore"
        }
      }
    },
    "expect": {
      "compiles": true,
      "findings": [
        "warning:mutation-undescribed"
      ],
      "tools": {
        "add-chore": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "title": {
              "type": "string",
              "maxLength": 500
            },
            "done": {
              "type": "boolean"
            },
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Optional: the id for the chore this makes. Refused if the graph already has it; left out, one is minted from the label."
            }
          },
          "required": [
            "title"
          ]
        },
        "edit-chore": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (chore)."
            },
            "title": {
              "type": "string",
              "maxLength": 500
            },
            "done": {
              "type": "boolean"
            }
          },
          "required": [
            "id"
          ]
        },
        "remove-chore": {
          "$schema": "https://json-schema.org/draft/2020-12/schema",
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1,
              "description": "Id of a node (chore)."
            }
          },
          "required": [
            "id"
          ]
        }
      }
    }
  },
  {
    "id": "log:vendors-booked-then-taken-back",
    "since": "0.1.1",
    "kind": "log",
    "document": "document:vendors",
    "ops": [
      {
        "id": "op1",
        "seq": 0,
        "batch": "batch:1",
        "author": {
          "kind": "human",
          "id": "nick",
          "roles": [
            "owner"
          ]
        },
        "intent": "Add a category: Florist",
        "mutation": {
          "name": "add-category",
          "args": {
            "name": "Florist",
            "budget": 3000
          }
        },
        "primitives": [
          {
            "op": "add-node",
            "node": {
              "id": "category:florist",
              "kind": "category",
              "name": "Florist",
              "budget": 3000
            }
          }
        ],
        "inverse": [
          {
            "op": "remove-node",
            "node": {
              "id": "category:florist",
              "kind": "category",
              "name": "Florist",
              "budget": 3000
            }
          }
        ],
        "reads": [
          "category:florist"
        ],
        "writes": [
          "category:florist"
        ],
        "at": "2026-10-02T09:00:00.000Z"
      },
      {
        "id": "op2",
        "seq": 1,
        "batch": "batch:2",
        "author": {
          "kind": "human",
          "id": "nick",
          "roles": [
            "owner"
          ]
        },
        "intent": "Add a vendor: Bloom & Co",
        "mutation": {
          "name": "add-vendor",
          "args": {
            "name": "Bloom & Co"
          }
        },
        "primitives": [
          {
            "op": "add-node",
            "node": {
              "id": "vendor:bloom-co",
              "kind": "vendor",
              "status": "researching",
              "name": "Bloom & Co"
            }
          }
        ],
        "inverse": [
          {
            "op": "remove-node",
            "node": {
              "id": "vendor:bloom-co",
              "kind": "vendor",
              "status": "researching",
              "name": "Bloom & Co"
            }
          }
        ],
        "reads": [
          "vendor:bloom-co"
        ],
        "writes": [
          "vendor:bloom-co"
        ],
        "at": "2026-10-02T09:00:01.000Z"
      },
      {
        "id": "op3",
        "seq": 2,
        "batch": "batch:3",
        "author": {
          "kind": "human",
          "id": "nick",
          "roles": [
            "owner"
          ]
        },
        "intent": "File under a category: Bloom & Co",
        "mutation": {
          "name": "file-under",
          "args": {
            "id": "vendor:bloom-co",
            "to": "category:florist"
          }
        },
        "primitives": [
          {
            "op": "add-edge",
            "edge": {
              "kind": "fills",
              "from": "vendor:bloom-co",
              "to": "category:florist"
            }
          }
        ],
        "inverse": [
          {
            "op": "remove-edge",
            "edge": {
              "kind": "fills",
              "from": "vendor:bloom-co",
              "to": "category:florist"
            }
          }
        ],
        "reads": [
          "vendor:bloom-co",
          "category:florist"
        ],
        "writes": [
          "vendor:bloom-co",
          "category:florist"
        ],
        "at": "2026-10-02T09:00:02.000Z"
      },
      {
        "id": "op4",
        "seq": 3,
        "batch": "batch:4",
        "author": {
          "kind": "human",
          "id": "nick",
          "roles": [
            "owner"
          ]
        },
        "intent": "Set the quote: Bloom & Co",
        "mutation": {
          "name": "set-quote",
          "args": {
            "id": "vendor:bloom-co",
            "quote": 2400
          }
        },
        "primitives": [
          {
            "op": "patch-node",
            "id": "vendor:bloom-co",
            "before": {
              "quote": "\u0000graview:unset"
            },
            "after": {
              "quote": 2400
            }
          }
        ],
        "inverse": [
          {
            "op": "patch-node",
            "id": "vendor:bloom-co",
            "before": {
              "quote": 2400
            },
            "after": {
              "quote": "\u0000graview:unset"
            }
          }
        ],
        "reads": [
          "vendor:bloom-co"
        ],
        "writes": [
          "vendor:bloom-co"
        ],
        "at": "2026-10-02T09:00:03.000Z"
      },
      {
        "id": "op5",
        "seq": 4,
        "batch": "batch:5",
        "author": {
          "kind": "human",
          "id": "nick",
          "roles": [
            "owner"
          ]
        },
        "intent": "Book: Bloom & Co",
        "mutation": {
          "name": "book",
          "args": {
            "id": "vendor:bloom-co"
          }
        },
        "primitives": [
          {
            "op": "patch-node",
            "id": "vendor:bloom-co",
            "before": {
              "status": "researching"
            },
            "after": {
              "status": "booked"
            }
          }
        ],
        "inverse": [
          {
            "op": "patch-node",
            "id": "vendor:bloom-co",
            "before": {
              "status": "booked"
            },
            "after": {
              "status": "researching"
            }
          }
        ],
        "reads": [
          "vendor:bloom-co"
        ],
        "writes": [
          "vendor:bloom-co"
        ],
        "at": "2026-10-02T09:00:04.000Z"
      },
      {
        "id": "op6",
        "seq": 5,
        "batch": "undo:6",
        "author": {
          "kind": "human",
          "id": "nick",
          "roles": [
            "owner"
          ]
        },
        "intent": "Undo: Book: Bloom & Co",
        "mutation": null,
        "primitives": [
          {
            "op": "patch-node",
            "id": "vendor:bloom-co",
            "before": {
              "status": "booked"
            },
            "after": {
              "status": "researching"
            }
          }
        ],
        "inverse": [
          {
            "op": "patch-node",
            "id": "vendor:bloom-co",
            "before": {
              "status": "researching"
            },
            "after": {
              "status": "booked"
            }
          }
        ],
        "reads": [
          "vendor:bloom-co"
        ],
        "writes": [
          "vendor:bloom-co"
        ],
        "at": "2026-10-02T09:00:05.000Z",
        "undoes": "op5"
      }
    ],
    "expect": {
      "hash": "sha256:db231bcf2f82d2a821f53ae69dba7c24f438c216f0e158d56ddf6d2dfb701a2f"
    }
  },
  {
    "id": "log:two-lines-made-and-done",
    "since": "0.1.1",
    "kind": "log",
    "document": "document:two-lines",
    "ops": [
      {
        "id": "op1",
        "seq": 0,
        "batch": "batch:1",
        "author": {
          "kind": "human",
          "id": "kai"
        },
        "intent": "Add a chore: Water the beds",
        "mutation": {
          "name": "add-chore",
          "args": {
            "title": "Water the beds"
          }
        },
        "primitives": [
          {
            "op": "add-node",
            "node": {
              "id": "chore:water-the-beds",
              "kind": "chore",
              "title": "Water the beds"
            }
          }
        ],
        "inverse": [
          {
            "op": "remove-node",
            "node": {
              "id": "chore:water-the-beds",
              "kind": "chore",
              "title": "Water the beds"
            }
          }
        ],
        "reads": [
          "chore:water-the-beds"
        ],
        "writes": [
          "chore:water-the-beds"
        ],
        "at": "2026-10-02T09:00:00.000Z"
      },
      {
        "id": "op2",
        "seq": 1,
        "batch": "batch:2",
        "author": {
          "kind": "human",
          "id": "kai"
        },
        "intent": "Change Water the beds: done → true",
        "mutation": {
          "name": "edit-chore",
          "args": {
            "id": "chore:water-the-beds",
            "done": true
          }
        },
        "primitives": [
          {
            "op": "patch-node",
            "id": "chore:water-the-beds",
            "before": {
              "done": "\u0000graview:unset"
            },
            "after": {
              "done": true
            }
          }
        ],
        "inverse": [
          {
            "op": "patch-node",
            "id": "chore:water-the-beds",
            "before": {
              "done": true
            },
            "after": {
              "done": "\u0000graview:unset"
            }
          }
        ],
        "reads": [
          "chore:water-the-beds"
        ],
        "writes": [
          "chore:water-the-beds"
        ],
        "at": "2026-10-02T09:00:01.000Z"
      }
    ],
    "expect": {
      "hash": "sha256:b29541a9aba631c123aaa684556f463846c22f3471b098e0147469e864874eb5"
    }
  }
] as never;
