export default function KnowledgeBasePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Knowledge Base</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Getting Started</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-medium">How do I sign up?</h3>
              <p className="text-gray-600">
                You can sign up for an account by clicking the &quot;Sign Up&quot; button on the homepage. You will need to provide your email address and create a password.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-medium">How do I create a new assessment?</h3>
              <p className="text-gray-600">
                Once you are logged in, you can create a new assessment from your dashboard. Click the &quot;New Assessment&quot; button and fill out the required information about the vehicle and the services you want to perform.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Billing and Payments</h2>
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-medium">How do I view my invoices?</h3>
              <p className="text-gray-600">
                You can view all of your past and current invoices in the &quot;Billing&quot; section of your account settings.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-medium">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                We accept all major credit cards, as well as payments through Stripe.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
