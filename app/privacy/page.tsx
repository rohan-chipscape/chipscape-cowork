export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-neutral-200">
      <h1 className="mb-6 text-2xl font-semibold text-neutral-100">Privacy Policy</h1>
      <p className="mb-4">
        Chipscape Cowork is a private internal assistant built for Chipscape. It is not a
        public product and is not offered to the general public.
      </p>
      <p className="mb-4">
        When you connect a Google Account, Cowork requests access to Gmail, Google Calendar,
        and Google Drive solely so that, at your direction, it can search, read, and send
        email, list and create calendar events, and search and read Drive files on your
        behalf. Every action that sends an email or creates a calendar event requires your
        explicit approval before it runs.
      </p>
      <p className="mb-4">
        Data retrieved from your Google Account is used only to answer your questions within
        this app and is not shared with any third party, sold, or used for advertising.
        Chat history and any linked account tokens are stored only on Chipscape&apos;s own
        private server.
      </p>
      <p className="mb-4">
        You can disconnect a connected Google Account at any time from within the app, or by
        revoking access at{" "}
        <a
          className="text-[#5b9bff] underline"
          href="https://myaccount.google.com/permissions"
        >
          myaccount.google.com/permissions
        </a>
        .
      </p>
      <p>Questions: contact rohan@chipscape.com.</p>
    </div>
  );
}
