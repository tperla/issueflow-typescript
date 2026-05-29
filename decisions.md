# Decisions during development

- I used Claude Code for development because it's a tool I love and am learning to use correctly

- I decided to implement an SDLC methodology so that the development steps would be clear and it would be easy to fix problems even in later stages

- I decided to add a password field for the user.

- I debated about the first login to the system, whether to allow users not to be secured with JWT, I decided that it was not safe, so I thought maybe to create a user in the db myself and use that to log in to the system for the first time, and in the end I decided to seed admin on startup.
