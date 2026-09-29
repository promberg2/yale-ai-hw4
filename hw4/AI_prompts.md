# AI Prompt Log

This file is a documentation log of the prompts I typed while working on Homework 4.
It is not a runtime prompt file for the model.

**Format for each problem**
- Problem number and title
- The first prompt I typed for that problem
- Every follow-up prompt I typed for that problem, in order (or "none" if one prompt was enough)
- What was lacking in the first prompt: in plain words, what I had to change or add, and why the follow-up made the result better (or why one prompt was enough)

---

## General setup

These prompts came before the numbered homework problems. They set the workspace.

### Setup - Open Homework 4

**First prompt I typed:**
`now we want to work in homewrok 4`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing was missing for what it had to do. This prompt only told the AI which folder to work in. It didn't start any problem yet, so no second prompt was needed; the real work began with Problem 1 in the next message.

---

## Problem sections

### Problem 1 - Vibe coder prompt

**First prompt I typed:**
`Now we do Problem 1 called Vibe coder prompt. As always we set up the AI_prompts.md file that logs my prompts for this homework. as before we include problem number and title, the first prompt i type and the follow up prompt if needed. then as before add a sentence that explains in a natural way what was missing in the first prompt and why the subsequent prompts where required.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
Nothing important was missing. I said exactly what the log should contain for each problem: the number and title, my first prompt, any follow-up, and a short explanation of what the first prompt left out. Because the instructions were complete, one prompt was enough to set up this file.

### Problem 2 - Analyze the database

**First prompt I typed:**
`Ok now we do problem 2 called Analyze the database. For this problem I will give you the data package for this homework. c:\Users\phili\Downloads\data (3).zip. Unzip it and safe it. The first part of the data we will have a look at is data/campus_customs.db which is our database. We will need that to create output/harness.md, which includes each table and its associated fields. Then in detail and in great lanagauage we have to set that into context why each field matters for a shop and a chatbot we will create later. Write a sentence per field. This step is important because it is the legwork for this later things we will build. We will continue to build the harness.`

**Follow-up prompts:**
1. `do we explain in the harness why we need teh respective fields for the shop and the chatbot seperatly?`
2. `make the change. It is key that we two context driven information that explain why this matter for 1 chatbot and 2 shop for the campus customs product, for all the tables. Take your time we need a great harness`

**What was lacking in the first prompt:**
I asked for one sentence per database field explaining why it matters "for a shop and a chatbot", but I didn't say those were two separate questions. So the first version mixed both into one sentence, which mostly talked about the chatbot and said little about the business. For a field like the price, the reader learned that the chatbot can quote it, but not why it matters for the shop's revenue. In the first follow-up I asked whether the two were really explained separately; they weren't. In the second I asked for the fix: two explanations for every field in every table, one for the chatbot and one for the shop, both about Campus Customs specifically. That made the analysis much more useful as groundwork for building the shop and the chatbot.

### Problem 3 - Build the Campus Customs website

**First prompt I typed:**
`Now we will do Problem 3 called Build the campus custom website. We will now build a great frontend website with React, Vite and TypeScript. The website has to be visually stunning and impressive but look like designed for Yale. Really show of here and show me what you can do, use established standarts for building great shops within the means of my input.  It has to compete with the best online fashion shops that are out in the web. The website needs a Navigation bar at the top that links to our different pages: Home, Products, About Us, Log in, Create Account. For Home and About Us we will pull information and wording from the current campus groups website https://yalebulldogblue.com/. Read that website carefully and in detail so that we can do home and baout us correctly and in similar wording but improved for the new site. Next we do the product page. For the products page we will pull the data from the catalogue, you already have the image paths from our database and match that with basic product info: name, price, short but well written description. CReate the product page, and all the products have to be clickable, which opens a separate product page for every product. This signle item page has to be consistent across products and has a large image of the product on the other side and the associated product text on the other side, which includes a great description, the price, sizes, and the stock when we have it. In the bottom right corner we will have a floating chatbot panel that has to be great aswell. It has to compete with the best online fashion shops that are out in the web. The chatbot does not need tot alk to the agent yet we will add that later in the backend. But all the visual things have to be implement now. We will spend more time building the backend later, but for now start a FastAPI app in the backend/main.py to give products ad images. Frontend and backend have to communicate. later we will add the agent for our awesome chatbot. Take your time.`

**Follow-up prompt:**
`everything works?`

**What was lacking in the first prompt:**
The prompt described the whole website in detail: which tools to build it with, every page in the menu, where to take the wording for Home and About Us, how the product list and each product page should look, and the chat window in the corner, with the chatbot's "brain" to follow later. What it didn't ask for was a check that everything actually works together. A website this size can look finished and still have a broken page or missing pictures. So I asked "everything works?". Every page was then opened in a real browser, on a computer screen and on a phone-sized screen, without errors. The answer also listed clearly what was still a placeholder on purpose (login, checkout, and the chatbot's real answers), so I knew what the next problems had to deliver.

### Problem 4 - Create account and login

**First prompt I typed:**
`OK now we will do Problem 4 called Create account and login. We have the log in button already. Now we will create a create account/log in flow that is on par with existing shops. The customer needs the ability to create an account with the inputs: first name, last name, email, password and confirm password. All that a current customer expects from such a page. After that and for all future visits the customer has to be able to log in with his email and password. New accounts go into the users table. We will store the passwords as safe as possible that it cant be stolen by hacker or AI. Hash them. Use current industry practice everything has to be on par with current industry standards. We have a test user in the database. Check if we are able to log in as that user I will also later check that manually. then check if we can log in as a new user. All the ideas we introduce to make that on par with current websites and all the other ideas for our create account log in flow have to be explained in detail and in good language in the output/harness.md file.`

**Follow-up prompts:**
1. `the test users password is password`
2. `so the login works?`

**What was lacking in the first prompt:**
The requirements were complete, but one piece of information was missing: the test user's password. Passwords are stored only in scrambled form, which is the point of storing them safely, so there was no way to find out the password and test that account's login. The first follow-up supplied it. With it, the AI could confirm that the existing test account logs in, and that it works with the older password format the database came with. The second follow-up was a direct check: before trying it myself, I wanted proof that the login really worked. It was tested again live (the website had to be restarted for that), so I could hand it over for my own manual test with confidence.

### Problem 5 - PydanticAI agent backend

**First prompt I typed:**
`Now we do Problem 5 called PydanticAI agent backend. Now we will build the chatbot of our website, that works with our floating front end chat widget. The API app will live in backend/main.py the file your un with Uvicorn. Keep the agent next to it as four files: backend/prompts/prompt.md that has the agents system prompt, backend/agent.py  which has the agent entry and wiring, backend/tools.py which has the agent tools, and backend/models.py which has PydanticAI structured types. The website should return answers from the agent. The agent needs to be bale to access all relevant information to give good answers. The agent should use my API Key to call an open ai 5.6 model to do its work and create the best possible answers to the customer. Now we have to make the chatbot safe and use a consistent voice. The answers voice has to be in line with the rest of our wording. Add sensible safety feature to the agent. Both have to be stored in prompts/prompt.md of our agent. Update or add types in model.py for chat relies and product cards if needed. The goal is to have a chatbot that serves our customers as good as possible. The backend has to run from the backend/ folder like uvicorn main:app --reload --port 8000. Then update our output/harness.md, to explain all that we did here, how the frontend talks to FastAPI and how the agent is loaded prompt file and model in detail. Sort the harness in a way that all the answers are connected to the problem in which they were created so that the grader can see the associated entries for all the different problems we solve.`

**Follow-up prompt:**
`does everything work`

**What was lacking in the first prompt:**
The prompt was detailed: which files the chatbot consists of, how to start it, which AI model family to use, that it needs a consistent voice and safety rules, and that everything must be documented. It didn't name the exact model version or say where my API key (the password that lets the program use the AI) is stored, so the AI reused the setup from Homework 3. What the first prompt didn't ask for was proof. A chatbot can look finished and still fail on a real question. So I followed up with "does everything work", and the whole chain was then tested live: the website, the server behind it, logging in, and a real answer from the chatbot.

### Problem 6 - Tools: product info and stock

**First prompt I typed:**
`Now we do Problem 6 called Tools: product info and stock. Now we want to give the agent additional tools to look up all the information it needs from our database campus_customs.db, like: Product description, price, how many are ins tock by size if the customer asks. It is key that the agent does not invent data, it should only use data from the database, as its goal is to support the customer and help us to sell more. If a size is out of stock it has to clearly communicate that to the customer. Expand prompt.md so that the agent knows how to call the tools for price and stock inquiries. Update the return types accordingly in models.py. Everything has to work to serve our customers as best as possible. For documentation and grading we have to add to our output/harness.md and explain each tool and which fields are choosen for lookup results and why in detail. this has to be good.`

**Follow-up prompt:**
`The agent now has all the tools it needs?`

**What was lacking in the first prompt:**
The prompt said which information the chatbot must be able to look up (description, price, stock per size), that it must never invent anything, and that it must say clearly when a size is sold out. It didn't say what should happen *after* "sold out", so the chatbot now also offers the nearest sizes in stock and similar products in the customer's size, which keeps a sale from ending in a dead end. The prompt also didn't make clear whether this was the complete set of abilities. So I asked whether the chatbot now had everything it needs. The answer made the limits visible: product questions were fully covered, but the chatbot couldn't yet look up orders or add things to the bag. Some of those abilities were added later, in Problem 9.

### Problem 7 - Chat search that updates the page

**First prompt I typed:**
`Now we do Problem 7 called Chat search that updates the page. Now we build a feature to improve our customer experience. We now take customer input through the chatbot like "what hoodies do you have", the agent does it thing, but now teh website should adapt as a result of that customers request. The website has to then according to the customers question dynamically show the matching product cards (with everything that is part of the product cards normally), this has t work seamlessly. This is an API contract the gaent answers the question and returns the according products, then the frontend website renders them on the website. This has to look appealing to the customer. The newly shown product cards need to have the same single item properties as before, meaning when I click onto one of them the single item product page opens, Obviously it has to be the same single item page as if I would have just manually clicked through the menus. Update prompts/prompt.md and our output/harness.md accordingly. It has to be clear how the agents search results reach the page.`

**Follow-up prompt:**
`when i put in my request and the website updates to show we the stuff, the chat closes. that is not good because when i have additional questions i have to reopen. REwork that the website still shows me the clickable products but also gives me the opportunity to read the chat. maybe we can shrink the cahtwindow when the website updates so i can still read the chat and scroll the updated website. That isjust a suggestion.  make it logiccal and intutitve to use for our customers`

**What was lacking in the first prompt:**
The first prompt described the feature well: when a customer asks the chatbot something like "what hoodies do you have?", the website itself should show the matching products as normal, clickable product cards. What it didn't say was what should happen to the chat window while the page changes. The first version simply closed the chat so the products could be seen. When I tried it, that felt wrong: every time I wanted to ask a follow-up question, I had to open the chat again and had lost sight of the conversation. So I asked for a version where I can see the products and the chat at the same time. Now the chat never closes on its own. On a wide screen it moves to the side next to the results, on a smaller screen it shrinks to a compact panel, and on a product page it shrinks to just its input box. It also knows which product is open, so a question like "Which sizes are left?" is understood as being about that product.

### Problem 8 - Customer memory

**First prompt I typed:**
`Now we do Problem 8 called Customer memory. When the customer is logged in save their chat history in the database in an appropriate table and reload when they return to the website. When someone is logged in the agent should have all the info on that customer like name, email and history, put that in the agent deps or somewhere else where it makes most sense and in the tools the3 agent can call. The goal is that the chatbot is the most usefull for people who are logged into the website. In order for the agent to work in the best way possible, the agent needs the appropriate context from what the customer is currently viewing and his chat history our chatbot has to work as a shopping supporter, so he needs all the information to support the customer as good as possible, the goal is to support the customer and spend as much as possible on our website. Guest which are logd in still need to be able to chat, but this memory is only avaible for logged in users. Update output/harness.md how the chat history is stored, what customer fields the agent has to answer questions and how page context is passed.`

**Follow-up prompt:**
*(none)*

**What was lacking in the first prompt:**
One prompt was enough, but two points had to be interpreted. First, I wrote "Guest which are logd in" when I meant guests who are *not* logged in: they can still chat, but the chatbot doesn't remember them. Second, I didn't spell out what "what the customer is currently viewing" includes, or how hard the chatbot should push sales. The chatbot now knows the product that is open, the size the customer picked, the products on screen, and what is in the bag, all checked against the current stock. It suggests at most one matching extra item per answer and never invents urgency, because a helpful assistant that customers trust sells more over time than a pushy one.

### Problem 9 - Usability improvements

**First prompt I typed:**
`Now we do Problem 9 called Usability improvements. For that we will do 2 separate front end usability improvements and two separate agent/ backend usability improvements. The goal is to create a better website that can compete with the best fashion stores out there and gives customers a great and intuitive experience, and leads to more sales for our business. For frontend I want that logged in customers have their own individual page with products they can whishlist/safe for the future and other features that customers would expect on a my account page on such a website. for the second improvement do something that gets us closer to the goal, for that look at the website. For our agent/backend improvements first make the agent faster, it takes to long to answer, for the second improvement do something according to our goals. this has to be the best website so take your time and give good results. Create output/usability.md as you build, for each of our improvements explain in detail and great language what we added ad why it helps a campus customs shopper or the business. These have to be good improvements and have to be explained logically as graders will look at this file.`

**Follow-up prompt:**
`usability md is great. just dondt diffrentiate what i said and what you came up with that is not relevant for this file`

**What was lacking in the first prompt:**
I named two of the four improvements (a My Account page with a wishlist, and a faster chatbot) and left the other two open ("do something that gets us closer to the goal"). The biggest gap on the website was that a customer could fill the bag but never buy, because the Checkout button didn't work yet, so the third improvement became a real checkout. The fourth lets the chatbot *do* things when asked (add to the bag, save to the wishlist) and look up the customer's own orders, which turns advice into sales. What the prompt didn't say was how the write-up should present these choices. The first version of `usability.md` kept pointing out which improvements I had asked for and which the AI had picked. That is useful for this prompt log, but not for a grader reading about the shop. My follow-up asked to drop that distinction, so `usability.md` now simply explains each improvement and why it helps shoppers and the business.

### Problem 10 - Style the website

**First prompt I typed:**
`Now we do Problem 10 called Style the website. We already have a great website with everything that is mentioned in the problem, like fonts color hierarchy motion product presntation and chat feel, mention that in output but there are still things we can improve to have even more stunning, innovative and great design. I will give you inputs add to them, we want the most inviting and stunning website for college gear people have ever ssen. we want to really show of and wow everyone. After write output/design.md what we cghaged and why it helps to have customer stick around and purchase from us. Keep it concrete and short. First the first landing page should show produtcs that we sell when teh customer lands on it without having to scroll first. the the products should scroll change the picture of the displayed clothing in regular intervals. also not all product picture and products are the same. just show the most impressive products right in the beginning to lure in the customers. Maybe connec to current yale events or the current season. like it is getting colder. the first page can be dynamic.  Look at other award wining stores and take some of their good visual ideas and implement them here when they serve our goals. We want the best website.`

**Follow-up prompt:**
`we are missing log in and create account from the nav bar`

**What was lacking in the first prompt:**
The prompt set clear goals for the new front page: products visible right away without scrolling, pictures that change on their own, only the most impressive products, and a link to the season or Yale events. It left the details open (which products, which events, how fast the pictures change), so the page now follows the Yale calendar and the live New Haven weather, with six hand-picked products per season. What the first prompt couldn't cover was the rest of the page staying intact while the design changed. When I looked at the new page in a narrower window, the Log in and Create Account buttons were gone from the top bar; they only appeared inside the ☰ menu. For a shop that wants customers to sign up, that's a real problem, so I asked for them back. Now both stay visible at every screen size. On phones they shrink to an icon and a short "Sign up" button.

### Problem 11 - Site testing (app check)

**First prompt I typed:**
`Now we do Problem 11 called Site testing (app check). We want to now test the life site and document our results in output/app_check.html, a page that can be opened by doubleclick by me or everyone else. For every check the site has to include clear detailed screenshots and a short but great caption for: 1. Chatbot checking the inventory level of an item (honest stock and price pulled from the database); 2. The dynamic search result cards appearing after a category question like asking for hoodies in the chatbot; 3. the best of of the usability features we added in Problem 9. We want the HTML build in a way that is easy to grade and give all the information for a perfect grade for all 3 points. Include heading for each check, screenshot, one or two sentences on what the screenshot proves. Take your time and make the best result possible, if the screenshot is not perfect retake to get the best possible result. Put the screenshot image files in output/app_check_images/ and link them from app_check.html with relative paths like for example app_check_images?inventory.png. These test are very important.`

**Follow-up prompt:**
`show me the html site`

**What was lacking in the first prompt:**
The prompt said clearly what the test report must show, but not which products and questions to test, how to prove the chatbot's answers are honest, or what to do if the test finds a problem. The test used one product with only 2 left in a size and one that is sold out, so both kinds of honest answer are shown, and every answer was compared with the database at the same moment. The problems the test found were fixed and listed in the report instead of hidden: a chatbot budget that was too small, part of the page sliding sideways on phones, and a grey shadow on the page edge. The follow-up was simple. The report was meant to be opened by double-click, so I asked to see it exactly the way a grader would, to judge how it looks before submitting.

### Problem 12 - Audit trail, safety, finish harness

**First prompt I typed:**
`Now we do Problem 12 called Audit trail, safety, finish harness. Keep an append only output/audit_trail.json of our agent loop activity that includes time, tool name, short args/result, stop reason. Do not wipe that between runs. Also we have to develop some more agent safety rules ontop of the rules we already have and add them to prompts/prompt.md. Then we now finish our output/harness.md so it is clear to the grader how the system works. That includes all the model fields in model.py and why we chose them, all the tools and abilities, all safety rules and all specs like loop limits, result caps, models and how to run front and back.`

**Follow-up prompts:**
1. `is the harness written in a way that a human can read and undertsna everything naturally and easily`
2. `do the fixes and make 12 more readable overall for non technical readers without nloosing any of the detail`
3. `all the detail required in the first problem 12 prompt is still there`
4. `structure problem 12 harness in "Model fields in models.py and why" first, then Tools and abilities then Safety rules then Specs (loop limits, result caps, models, how to run front and back)`

**What was lacking in the first prompt:**
The first prompt said clearly *what* to build: a permanent logbook of the chatbot's work, more safety rules, and a finished harness. It left some words open. "Stop reason" could mean why the chatbot paused for a moment or why it finished answering, so the logbook records both. "Short" was set at one line per entry. The prompt also didn't say whether customers' personal details may appear in the logbook, so they are kept out: emails and card numbers are hidden. The new safety rules cover what the old ones left open: how far the chatbot may act on its own, protecting payment and personal data, being honest that it is an AI, and staying calm under pressure.

The follow-ups were all about the harness. I asked for it to be "clear to the grader" but never said who that reader is, so the first version was written for programmers, full of technical terms without explanation. It also still had some outdated statements from earlier problems and no section for Problem 11. So I first asked whether a normal person could read it easily. That honest check showed the problems, and in my second follow-up I asked for them to be fixed and for Problem 12 to be rewritten for non-technical readers without losing any detail. Because making text simpler can easily drop information, my third follow-up asked to confirm that everything from my first prompt was still there; it was checked piece by piece against the actual code. Finally, my first prompt had listed the four topics (the data fields, the tools, the safety rules, and the technical specs) but hadn't said they should appear in that order. My fourth follow-up asked for exactly that order, so a grader can now follow the harness step by step through the list the assignment asks for.

---
