# AI Prompt Log

This file is a documentation log of the prompts I typed while working on Homework 4.
It is not a runtime prompt file for the model.

**Format for each problem**
- Problem number and title
- The first prompt I typed for that problem
- One follow-up prompt, if I used one (later follow-ups listed when they mattered)
- What was lacking in the first prompt — why a follow-up was needed, or why one prompt was enough

---

## General setup

These prompts came before the numbered homework problems. They set the workspace.

### Setup - Open Homework 4

**First prompt I typed:**
`now we want to work in homewrok 4`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
This was only a workspace handoff. It told the agent to move into Homework 4, but it did not name a problem, give a title, or ask for the vibe-coder prompt log. That was enough to open the folder, and Problem 1 came in the next message.

---

## Problem sections

### Problem 1 - Vibe coder prompt

**First prompt I typed:**
`Now we do Problem 1 called Vibe coder prompt. As always we set up the AI_prompts.md file that logs my prompts for this homework. as before we include problem number and title, the first prompt i type and the follow up prompt if needed. then as before add a sentence that explains in a natural way what was missing in the first prompt and why the subsequent prompts where required.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing important was missing. The prompt already named Problem 1, gave the title “Vibe coder prompt,” and specified the log: problem number and title, the first prompt, a follow-up only if one was needed, and a natural sentence on what the first prompt left out. One prompt was enough to create the file.

### Problem 2 - Analyze the database

**First prompt I typed:**
`Ok now we do problem 2 called Analyze the database. For this problem I will give you the data package for this homework. c:\Users\phili\Downloads\data (3).zip. Unzip it and safe it. The first part of the data we will have a look at is data/campus_customs.db which is our database. We will need that to create output/harness.md, which includes each table and its associated fields. Then in detail and in great lanagauage we have to set that into context why each field matters for a shop and a chatbot we will create later. Write a sentence per field. This step is important because it is the legwork for this later things we will build. We will continue to build the harness.`

**Follow-up prompt:**
`do we explain in the harness why we need teh respective fields for the shop and the chatbot seperatly?`

Later follow-up: `make the change. It is key that we two context driven information that explain why this matter for 1 chatbot and 2 shop for the campus customs product, for all the tables. Take your time we need a great harness`

**What was lacking in the first prompt:**
The first prompt asked for one sentence per field explaining why it matters "for a shop and a chatbot," but it did not say those two angles had to be kept apart. The first harness blended them into a single sentence that leaned toward the chatbot, so the business value of fields like `price` or `colors` was thin. The follow-ups made the requirement explicit: two separate, Campus Customs–specific explanations per field — first for the chatbot, then for the shop — across every table.

### Problem 3 - Build the Campus Customs website

**First prompt I typed:**
`Now we will do Problem 3 called Build the campus custom website. We will now build a great frontend website with React, Vite and TypeScript. The website has to be visually stunning and impressive but look like designed for Yale. Really show of here and show me what you can do, use established standarts for building great shops within the means of my input.  It has to compete with the best online fashion shops that are out in the web. The website needs a Navigation bar at the top that links to our different pages: Home, Products, About Us, Log in, Create Account. For Home and About Us we will pull information and wording from the current campus groups website https://yalebulldogblue.com/. Read that website carefully and in detail so that we can do home and baout us correctly and in similar wording but improved for the new site. Next we do the product page. For the products page we will pull the data from the catalogue, you already have the image paths from our database and match that with basic product info: name, price, short but well written description. CReate the product page, and all the products have to be clickable, which opens a separate product page for every product. This signle item page has to be consistent across products and has a large image of the product on the other side and the associated product text on the other side, which includes a great description, the price, sizes, and the stock when we have it. In the bottom right corner we will have a floating chatbot panel that has to be great aswell. It has to compete with the best online fashion shops that are out in the web. The chatbot does not need tot alk to the agent yet we will add that later in the backend. But all the visual things have to be implement now. We will spend more time building the backend later, but for now start a FastAPI app in the backend/main.py to give products ad images. Frontend and backend have to communicate. later we will add the agent for our awesome chatbot. Take your time.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing important was missing. The prompt named the stack (React, Vite, TypeScript, FastAPI), every page in the navigation, the source site for Home and About Us, the product-listing and single-product layout, the stock and size details, and the floating chatbot panel, and it made clear the agent would come later. One prompt was enough to build the full storefront and the product API.

### Problem 4 - Create account and login

**First prompt I typed:**
`OK now we will do Problem 4 called Create account and login. We have the log in button already. Now we will create a create account/log in flow that is on par with existing shops. The customer needs the ability to create an account with the inputs: first name, last name, email, password and confirm password. All that a current customer expects from such a page. After that and for all future visits the customer has to be able to log in with his email and password. New accounts go into the users table. We will store the passwords as safe as possible that it cant be stolen by hacker or AI. Hash them. Use current industry practice everything has to be on par with current industry standards. We have a test user in the database. Check if we are able to log in as that user I will also later check that manually. then check if we can log in as a new user. All the ideas we introduce to make that on par with current websites and all the other ideas for our create account log in flow have to be explained in detail and in good language in the output/harness.md file.`

**Follow-up prompt:**
`the test users password is password`

**What was lacking in the first prompt:**
The first prompt was complete on requirements — the account fields, login for return visits, writing to the `users` table, safe password hashing to industry standard, verifying both the test user and a new user, and documenting every choice in the harness. The one thing it could not provide was the test user's password, and the stored hash omits the iteration count, so there was no way to verify that specific account without it. The follow-up supplied the password (`password`), which let me confirm the login works and detect the legacy hash settings so our verifier stays compatible.

Later follow-up: `so the login works?` — a check-in question rather than a correction; it prompted a live re-test (and a restart of the stopped frontend) before handing over for manual testing.

### Problem 5 - PydanticAI agent backend

**First prompt I typed:**
`Now we do Problem 5 called PydanticAI agent backend. Now we will build the chatbot of our website, that works with our floating front end chat widget. The API app will live in backend/main.py the file your un with Uvicorn. Keep the agent next to it as four files: backend/prompts/prompt.md that has the agents system prompt, backend/agent.py  which has the agent entry and wiring, backend/tools.py which has the agent tools, and backend/models.py which has PydanticAI structured types. The website should return answers from the agent. The agent needs to be bale to access all relevant information to give good answers. The agent should use my API Key to call an open ai 5.6 model to do its work and create the best possible answers to the customer. Now we have to make the chatbot safe and use a consistent voice. The answers voice has to be in line with the rest of our wording. Add sensible safety feature to the agent. Both have to be stored in prompts/prompt.md of our agent. Update or add types in model.py for chat relies and product cards if needed. The goal is to have a chatbot that serves our customers as good as possible. The backend has to run from the backend/ folder like uvicorn main:app --reload --port 8000. Then update our output/harness.md, to explain all that we did here, how the frontend talks to FastAPI and how the agent is loaded prompt file and model in detail. Sort the harness in a way that all the answers are connected to the problem in which they were created so that the grader can see the associated entries for all the different problems we solve.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing essential was missing: the prompt fixed the file layout, the run command, the model family, the voice and safety requirements, the structured types, and the harness reorganisation. Two details were left for me to resolve from earlier work rather than a follow-up — which exact "OpenAI 5.6" model to use and where the API key lives — so I reused the Homework 3 setup (`gpt-5.6-sol` through Portkey, with `PORTKEY_API_KEY` loaded from the course `.env`).

Later follow-up: `does everything work` — a check-in question; it prompted a live end-to-end check of the backend, website, login, and a real chat answer.

### Problem 6 - Tools: product info and stock

**First prompt I typed:**
`Now we do Problem 6 called Tools: product info and stock. Now we want to give the agent additional tools to look up all the information it needs from our database campus_customs.db, like: Product description, price, how many are ins tock by size if the customer asks. It is key that the agent does not invent data, it should only use data from the database, as its goal is to support the customer and help us to sell more. If a size is out of stock it has to clearly communicate that to the customer. Expand prompt.md so that the agent knows how to call the tools for price and stock inquiries. Update the return types accordingly in models.py. Everything has to work to serve our customers as best as possible. For documentation and grading we have to add to our output/harness.md and explain each tool and which fields are choosen for lookup results and why in detail. this has to be good.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing essential was missing: it named the data to expose (description, price, stock by size), the no-invented-data rule, the sold-out requirement, and the three files to change (tools, prompt, models), plus the harness write-up. It did not say what the agent should do *after* telling a customer a size is sold out, so I added in-stock alternatives (nearest sizes and similar products in that size), in line with the stated goal of helping the shop sell more.

Later follow-up: `The agent now has all the tools it needs?` — a check-in question; it clarified what the tools cover and which abilities (orders, bag actions, images, size charts) are intentionally or necessarily out of scope.

### Problem 7 - Chat search that updates the page

**First prompt I typed:**
`Now we do Problem 7 called Chat search that updates the page. Now we build a feature to improve our customer experience. We now take customer input through the chatbot like "what hoodies do you have", the agent does it thing, but now teh website should adapt as a result of that customers request. The website has to then according to the customers question dynamically show the matching product cards (with everything that is part of the product cards normally), this has t work seamlessly. This is an API contract the gaent answers the question and returns the according products, then the frontend website renders them on the website. This has to look appealing to the customer. The newly shown product cards need to have the same single item properties as before, meaning when I click onto one of them the single item product page opens, Obviously it has to be the same single item page as if I would have just manually clicked through the menus. Update prompts/prompt.md and our output/harness.md accordingly. It has to be clear how the agents search results reach the page.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing essential was missing. The prompt defined the behavior (the website adapts to a chat search), the contract (the agent returns products and the frontend renders them), the card and product-page requirements, and the files to update. It left open *where* the results appear and *which* questions should change the page. I chose the Products page at its own `/products?concierge=<id>` URL (so Back and reload work), and let only browsing questions update it, so a stock or policy question never pulls the customer away from what they are viewing.

Later follow-up: `when i put in my request and the website updates to show we the stuff, the chat closes. that is not good because when i have additional questions i have to reopen. REwork that the website still shows me the clickable products but also gives me the opportunity to read the chat. maybe we can shrink the cahtwindow when the website updates so i can still read the chat and scroll the updated website. That isjust a suggestion.  make it logiccal and intutitve to use for our customers`. The first prompt never said what the chat should do while the page changes, so I had closed it on small screens. Now the chat never closes on its own. It docks beside the results on wide screens, shrinks to a compact panel on smaller ones, and shrinks to just its header and input box on a product page. It also now knows which product is open, so "Which sizes are left?" refers to that product.

### Problem 8 - Customer memory

**First prompt I typed:**
`Now we do Problem 8 called Customer memory. When the customer is logged in save their chat history in the database in an appropriate table and reload when they return to the website. When someone is logged in the agent should have all the info on that customer like name, email and history, put that in the agent deps or somewhere else where it makes most sense and in the tools the3 agent can call. The goal is that the chatbot is the most usefull for people who are logged into the website. In order for the agent to work in the best way possible, the agent needs the appropriate context from what the customer is currently viewing and his chat history our chatbot has to work as a shopping supporter, so he needs all the information to support the customer as good as possible, the goal is to support the customer and spend as much as possible on our website. Guest which are logd in still need to be able to chat, but this memory is only avaible for logged in users. Update output/harness.md how the chat history is stored, what customer fields the agent has to answer questions and how page context is passed.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Two things were left to interpret. First, "Guest which are logd in" had to be read as guests who are *not* logged in: they can chat, but get no memory. Second, the prompt did not define "what the customer is currently viewing" or how far selling should go. I defined page context as the open product, the selected size, the catalogue filters or concierge results, and the bag, all re-checked against live stock. I also kept the selling guidance helpful rather than pushy (one complementary suggestion per reply, no invented urgency), because customers who trust the concierge spend more over time.

### Problem 9 - Usability improvements

**First prompt I typed:**
`Now we do Problem 9 called Usability improvements. For that we will do 2 separate front end usability improvements and two separate agent/ backend usability improvements. The goal is to create a better website that can compete with the best fashion stores out there and gives customers a great and intuitive experience, and leads to more sales for our business. For frontend I want that logged in customers have their own individual page with products they can whishlist/safe for the future and other features that customers would expect on a my account page on such a website. for the second improvement do something that gets us closer to the goal, for that look at the website. For our agent/backend improvements first make the agent faster, it takes to long to answer, for the second improvement do something according to our goals. this has to be the best website so take your time and give good results. Create output/usability.md as you build, for each of our improvements explain in detail and great language what we added ad why it helps a campus customs shopper or the business. These have to be good improvements and have to be explained logically as graders will look at this file.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Two of the four improvements were left open ("do something that gets us closer to the goal"), so I had to choose them. Looking at the website, the biggest gap was that the Checkout button was disabled: a customer could fill a bag but never buy. I made the second frontend improvement a real checkout (shipping or pickup, tax, a free-shipping goal, stock-safe order placement, and an order confirmation). For the second backend improvement, I let the concierge *act* on explicit requests (add to bag, save to wishlist) and look up the customer's own orders and wishlist, because that turns advice into sales. "Make the agent faster" gave no target, so I measured the agent before and after on the same questions. "Whishlist/safe" was read as "wishlist / save for later", and "features customers would expect" as orders, recently viewed, profile with saved size and address, and password and privacy controls.

Later follow-up: `usability md is great. just dondt diffrentiate what i said and what you came up with that is not relevant for this file` — the first prompt did not say whether the write-up should mention which improvements were chosen by me, so I removed that framing from `usability.md` (this file keeps it).

### Problem 10 - Style the website

**First prompt I typed:**
`Now we do Problem 10 called Style the website. We already have a great website with everything that is mentioned in the problem, like fonts color hierarchy motion product presntation and chat feel, mention that in output but there are still things we can improve to have even more stunning, innovative and great design. I will give you inputs add to them, we want the most inviting and stunning website for college gear people have ever ssen. we want to really show of and wow everyone. After write output/design.md what we cghaged and why it helps to have customer stick around and purchase from us. Keep it concrete and short. First the first landing page should show produtcs that we sell when teh customer lands on it without having to scroll first. the the products should scroll change the picture of the displayed clothing in regular intervals. also not all product picture and products are the same. just show the most impressive products right in the beginning to lure in the customers. Maybe connec to current yale events or the current season. like it is getting colder. the first page can be dynamic.  Look at other award wining stores and take some of their good visual ideas and implement them here when they serve our goals. We want the best website.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
The prompt gave clear goals (product above the fold, rotating pictures, only the best products, a seasonal or event tie-in) but left open *which* products count as "most impressive", *which* Yale events, how often to rotate, and which award-winning ideas to borrow. I reviewed every product photo and hand-picked six per season, tied the page to the Yale calendar (fall, The Game, holidays, winter, spring, commencement, summer, move-in) plus the live New Haven weather, rotated every 5.6 seconds with a pause on hover, and borrowed only ideas that shorten the path to the bag (a flagship-style spotlight, story progress bars, quick add, a sticky bag bar). "The products should scroll" was read as "rotate automatically", not "scroll-jack the page".

### Problem 11 - Site testing (app check)

**First prompt I typed:**
`Now we do Problem 11 called Site testing (app check). We want to now test the life site and document our results in output/app_check.html, a page that can be opened by doubleclick by me or everyone else. For every check the site has to include clear detailed screenshots and a short but great caption for: 1. Chatbot checking the inventory level of an item (honest stock and price pulled from the database); 2. The dynamic search result cards appearing after a category question like asking for hoodies in the chatbot; 3. the best of of the usability features we added in Problem 9. We want the HTML build in a way that is easy to grade and give all the information for a perfect grade for all 3 points. Include heading for each check, screenshot, one or two sentences on what the screenshot proves. Take your time and make the best result possible, if the screenshot is not perfect retake to get the best possible result. Put the screenshot image files in output/app_check_images/ and link them from app_check.html with relative paths like for example app_check_images?inventory.png. These test are very important.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
The prompt did not say *which* items or questions to test, how to prove the answers are "honest", which Problem 9 features count as "the best", or what to do if testing finds a bug. I picked one nearly sold-out size and one sold-out size so both honesty cases were shown, and compared every answer against the database during the same run. For check 3 I chose the features that shorten the path to a purchase (a concierge that acts, live progress, pickup checkout, My Account), used a throwaway test customer, and deleted all test data afterwards. The bugs the test found (a token budget that was too tight, a stale backend, sideways scrolling on phones, a leaking drawer shadow) were fixed and listed in the report rather than hidden. `app_check_images?inventory.png` was read as the relative path `app_check_images/inventory.png`.

### Problem 12 - Audit trail, safety, finish harness

**First prompt I typed:**
`Now we do Problem 12 called Audit trail, safety, finish harness. Keep an append only output/audit_trail.json of our agent loop activity that includes time, tool name, short args/result, stop reason. Do not wipe that between runs. Also we have to develop some more agent safety rules ontop of the rules we already have and add them to prompts/prompt.md. Then we now finish our output/harness.md so it is clear to the grader how the system works. That includes all the model fields in model.py and why we chose them, all the tools and abilities, all safety rules and all specs like loop limits, result caps, models and how to run front and back.`

**Follow-up prompts:**
1. `is the harness written in a way that a human can read and undertsna everything naturally and easily`
2. `do the fixes and make 12 more readable overall for non technical readers without nloosing any of the detail`
3. `all the detail required in the first problem 12 prompt is still there`
4. `structure problem 12 harness in "Model fields in models.py and why" first, then Tools and abilities then Safety rules then Specs (loop limits, result caps, models, how to run front and back)`

**What was lacking in the first prompt:**
The first prompt said clearly *what* to build, but left several of its key words undefined. "Stop reason" could mean why the model paused inside a run or why the whole run ended, so the audit trail records both: a `finish_reason` for every model step and a `stop_reason` for every run (a normal answer, a blocked message, a rate or usage limit, an error, or a customer who closed the chat). "Append only" did not say how a file can keep growing and still be valid JSON, so each run replaces only the closing bracket, and old entries are never touched. "Short" was set at one line of at most 160 characters. The prompt also never said whether customer data may appear in the log, so customer tools are logged by counts only, and emails and card numbers are masked. For the new safety rules, I looked for what the existing rules left open: how far the chatbot may act on its own, how carefully it uses tools, payment and personal data, honesty about being an AI, and pressure tactics. The most important rules are also enforced in code. "model.py" was read as `backend/models.py`.

The follow-ups came from the harness itself. The first prompt asked for a harness that is "clear to the grader" but never said who that reader is, so the first version was written for developers: it used terms like `NativeOutput` and NDJSON without explaining them, still carried outdated statements in the Problem 5 sections, and had no Problem 11 section. So I asked for an honest readability check, and then for the fixes: the outdated lines were corrected, Problem 11 and a glossary were added, and every part of Problem 12 now opens with a plain-language summary, with the jargon explained. Because simplifying can easily drop detail, I then asked for confirmation that everything the first prompt required was still there, and it was checked against the code field by field and tool by tool. The last follow-up fixed the order: the first prompt listed the four topics (model fields, tools and abilities, safety rules, specs) but never said they should appear in that order, so Problem 12 was rearranged to follow them exactly, with "how to run the frontend and backend" placed inside the specs.

---
