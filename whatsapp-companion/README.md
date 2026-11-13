# Chipscape WhatsApp Companion

This lets Chipscape Cowork read and send WhatsApp messages for you. It has
to run on your own computer (not a server) because WhatsApp only trusts
pairing attempts that come from a normal home/office internet connection —
not a server sitting in a datacenter.

## Setup (one time)

1. Unzip this folder anywhere (e.g. your Desktop).
2. Double-click **`Start WhatsApp Companion.command`**.
   - If macOS shows a warning about an unidentified developer, right-click
     the file instead, choose **Open**, then confirm — you only need to do
     that once.
   - If it says Node.js isn't installed, it'll open the download page for
     you — install it, then double-click the file again.
3. The first time, it'll ask for your Cowork email and password in the
   Terminal window, then open an actual browser window showing WhatsApp
   Web. Open WhatsApp on your phone → Settings → Linked Devices → Link a
   Device, and scan the code shown in that browser window — exactly like
   logging into WhatsApp Web normally.

## Every time after that

Just double-click **`Start WhatsApp Companion.command`** again whenever you
want Cowork to have WhatsApp access. Leave the window open and running —
closing it disconnects WhatsApp from Cowork (your actual WhatsApp account
is unaffected; you can always reconnect by opening it again).
