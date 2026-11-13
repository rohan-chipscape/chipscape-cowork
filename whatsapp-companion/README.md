# Chipscape WhatsApp Companion

This lets Chipscape Cowork read and send WhatsApp messages for you. It has
to run on your own computer (not a server) because WhatsApp only trusts
pairing attempts that come from a normal home/office internet connection —
not a server sitting in a datacenter.

## Setup (one time)

1. Install [Node.js](https://nodejs.org) if you don't already have it (the
   button labeled "LTS" on that page).
2. Open Terminal (Mac) or Command Prompt (Windows), and go to this folder:
   ```
   cd path/to/whatsapp-companion
   ```
   (Drag the folder into the Terminal window after typing `cd ` to fill in
   the path automatically.)
3. Run:
   ```
   npm install
   npm start
   ```
4. The first time, it'll ask for your Cowork email and password, then show
   a QR code. Open WhatsApp on your phone → Settings → Linked Devices →
   Link a Device, and scan it.

## Every time after that

Just run `npm start` again in this folder whenever you want Cowork to have
WhatsApp access. Leave the window open and running — closing it disconnects
WhatsApp from Cowork (your actual WhatsApp account is unaffected; you can
always reconnect by running it again).
