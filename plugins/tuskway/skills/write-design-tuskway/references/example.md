# Worked shape

This is a shape, for an order-search change. It is not the feature in front of you. Cite only files you opened for the epic you were asked about.

Notes said search must stay in `src/orders/search.mjs`, and that a query shorter than two characters returns no rows. The repo's README said `node --test src/orders/search.test.mjs`. The test you opened was named "rejects a one-character query".

Two approaches were real: filter the in-memory order list in `search.mjs`, or add a SQL `LIKE` in `src/db/orders.mjs`. The recommendation was the in-memory filter, because the notes already constrain the file and the opened test calls `search()` with an array. The SQL option would make that test a lie.

The proposal had one index row, `Order search | search.md | T3 |`, and the section named `src/orders/search.mjs` and the test name above. It did not draft a ticket. The write waited until the user approved the row.
