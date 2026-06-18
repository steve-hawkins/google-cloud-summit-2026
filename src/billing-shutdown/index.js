const { google } = require('googleapis');
const billing = google.cloudbilling('v1');

exports.stopBilling = async (pubsubEvent, context) => {
  const data = JSON.parse(Buffer.from(pubsubEvent.data, 'base64').toString());
  const costAmount = data.costAmount;
  const budgetAmount = data.budgetAmount;
  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;

  console.log(`Current Spend: $${costAmount} (Budget limit: $${budgetAmount}) for project ${projectId}`);

  if (costAmount >= budgetAmount) {
    console.log('Budget limit exceeded! Disabling billing...');
    
    // Authenticate client using Application Default Credentials (ADC)
    const auth = await google.auth.getClient({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    google.options({ auth });

    const name = `projects/${projectId}/billingInfo`;
    try {
      await billing.projects.updateBillingInfo({
        name: name,
        resource: { billingAccountName: '' } // Setting this empty disables billing for the project
      });
      console.log(`Successfully disabled billing for project ${projectId}`);
    } catch (err) {
      console.error(`Failed to disable billing:`, err);
    }
  } else {
    console.log(`Spend is under budget limits. No action taken.`);
  }
};
