See [AGENTS.md](./AGENTS.md).

@AGENTS.md

## Project rules (poker home-game bank)
- Always use DeepSpace built-ins (auth, database, realtime, presence, permissions, AI chat) — never custom versions. Check the docs first.
- One feature per task. Propose the plan before writing code and wait for my OK.
- Never put secrets in code; use `npx deepspace secrets`.
- After each feature, append to NOTES.md under "Agent log": what was built, which agent wrote it (Claude Code or Codex), and files touched. Leave "What I verified" for me to write.