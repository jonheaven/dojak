import { Content, Header, Layout, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { spacing } from '@dojak/ui/theme/spacing';

export default function TermsOfServiceScreen() {
  const { t } = useI18n();

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('terms_of_service')}
      />
      <Content style={{ padding: spacing.medium }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
          <Text text="Dojak Wallet - Terms of Service" preset="title-bold" size="lg" style={{ marginBottom: spacing.medium }} />
          
          <Text text="Last Updated: March 4, 2026" preset="sub" style={{ marginBottom: spacing.large }} />

          <div style={{ marginBottom: spacing.large }}>
            <Text text="1. Acceptance of Terms" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="By installing and using Dojak Wallet, you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the wallet."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="2. Wallet Description" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Dojak Wallet is a non-custodial Dogecoin wallet that supports Doginals (inscriptions), DRC-20 tokens, Dunes tokens, DNS names, and Dogemaps. You retain full control and responsibility for your private keys and seed phrases."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="3. User Responsibilities" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="You are solely responsible for:"
              style={{ marginBottom: spacing.small }}
            />
            <ul style={{ marginLeft: spacing.medium, marginBottom: spacing.medium }}>
              <li><Text text="Securing your seed phrase and private keys" /></li>
              <li><Text text="All transactions you make using the wallet" /></li>
              <li><Text text="Verifying recipient addresses before sending funds" /></li>
              <li><Text text="Understanding the risks of cryptocurrency transactions" /></li>
              <li><Text text="Maintaining the security of your device" /></li>
            </ul>
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="4. Security Warnings" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="• Never share your seed phrase or private keys with anyone"
              style={{ marginBottom: spacing.tiny }}
            />
            <Text 
              text="• Dojak developers will never ask for your seed phrase"
              style={{ marginBottom: spacing.tiny }}
            />
            <Text 
              text="• Lost seed phrases cannot be recovered"
              style={{ marginBottom: spacing.tiny }}
            />
            <Text 
              text="• Transactions on the blockchain are irreversible"
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="5. No Warranty" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text='Dojak Wallet is provided "as is" without warranty of any kind. We do not guarantee uninterrupted access, error-free operation, or that the wallet will meet your requirements.'
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="6. Limitation of Liability" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="The Dojak team is not liable for any losses, damages, or claims arising from your use of the wallet, including but not limited to loss of funds, transaction errors, or security breaches of your device."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="7. Third-Party Services" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="The wallet may connect to third-party blockchain APIs and indexers. We are not responsible for the availability, accuracy, or security of these services."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="8. Prohibited Uses" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="You may not use Dojak Wallet for any illegal activities, to violate any laws or regulations, or to infringe on the rights of others."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="9. Changes to Terms" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="We reserve the right to modify these terms at any time. Continued use of the wallet after changes constitutes acceptance of the modified terms."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="10. Contact" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="For questions about these terms, please contact the Dojak development team through our official GitHub repository."
              style={{ marginBottom: spacing.medium }}
            />
          </div>
        </div>
      </Content>
    </Layout>
  );
}
