import { Content, Header, Layout, Text } from '@dojak/ui/components';
import { useI18n } from '@dojak/ui/hooks/useI18n';
import { spacing } from '@dojak/ui/theme/spacing';

export default function PrivacyPolicyScreen() {
  const { t } = useI18n();

  return (
    <Layout>
      <Header
        onBack={() => {
          window.history.go(-1);
        }}
        title={t('privacy_policy')}
      />
      <Content style={{ padding: spacing.medium }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', lineHeight: '1.6' }}>
          <Text text="Dojak Wallet - Privacy Policy" preset="title-bold" size="lg" style={{ marginBottom: spacing.medium }} />
          
          <Text text="Last Updated: August 28, 2026" preset="sub" style={{ marginBottom: spacing.large }} />

          <div style={{ marginBottom: spacing.large }}>
            <Text text="1. Overview" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Dojak Wallet is a non-custodial, privacy-focused Dogecoin wallet. This privacy policy explains what information we collect, how we use it, and your rights regarding your data."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="2. Non-Custodial Nature" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Dojak Wallet is non-custodial, meaning:"
              style={{ marginBottom: spacing.small }}
            />
            <ul style={{ marginLeft: spacing.medium, marginBottom: spacing.medium }}>
              <li><Text text="We never have access to your private keys or seed phrases" /></li>
              <li><Text text="We cannot access, freeze, or recover your funds" /></li>
              <li><Text text="We do not store your wallet data on our servers" /></li>
              <li><Text text="All wallet data is stored locally on your device" /></li>
            </ul>
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="3. Data Collection" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Dojak Wallet collects minimal data:"
              style={{ marginBottom: spacing.small }}
            />
            <ul style={{ marginLeft: spacing.medium, marginBottom: spacing.medium }}>
              <li><Text text="Local Storage: Your encrypted wallet data, preferences, and settings are stored only on your device" /></li>
              <li><Text text="Network Requests: When you use the wallet, your IP address may be visible to blockchain API providers we connect to" /></li>
              <li><Text text="Website provider: a page script (window.dojak) is injected so dApps can request connect/sign — we do not sell browsing history" /></li>
              <li><Text text="No Analytics: We do not use analytics or tracking services" /></li>
              <li><Text text="No Personal Information: We do not collect names, emails, or personal identification" /></li>
            </ul>
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="4. Third-Party Services" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Dojak Wallet connects to third-party services for blockchain data:"
              style={{ marginBottom: spacing.small }}
            />
            <ul style={{ marginLeft: spacing.medium, marginBottom: spacing.medium }}>
              <li><Text text="command.dog and dogex indexers for balances, Doginals, DRC-20, Dunes, and broadcast" /></li>
              <li><Text text="Ð𝕏 resolve/verify when you tip or link a profile on X" /></li>
              <li><Text text="Explorer links you choose to open (explorer.dogenals.com)" /></li>
            </ul>
            <Text 
              text="These services may log your IP address and the addresses you query. Please review their respective privacy policies."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="5. Blockchain Transparency" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="All transactions on the Dogecoin blockchain are public and permanent. Anyone can view transaction amounts, addresses, and timestamps. Dojak Wallet does not add additional privacy layers."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="6. Local Data Storage" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Your wallet data is encrypted and stored locally using your browser's extension storage API. We recommend:"
              style={{ marginBottom: spacing.small }}
            />
            <ul style={{ marginLeft: spacing.medium, marginBottom: spacing.medium }}>
              <li><Text text="Enabling device encryption" /></li>
              <li><Text text="Using a strong device password" /></li>
              <li><Text text="Backing up your seed phrase in a secure location" /></li>
              <li><Text text="Not sharing your device with untrusted parties" /></li>
            </ul>
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="7. Data Sharing" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="We do not sell, rent, or share your data with third parties. Since we do not collect personal information, there is nothing to share."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="8. Data Deletion" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="You can delete all wallet data at any time by uninstalling the extension. Make sure to back up your seed phrase before deletion, as this action is irreversible."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="9. Security" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="We implement industry-standard security practices, including:"
              style={{ marginBottom: spacing.small }}
            />
            <ul style={{ marginLeft: spacing.medium, marginBottom: spacing.medium }}>
              <li><Text text="Local encryption of wallet data" /></li>
              <li><Text text="Secure random number generation for key creation" /></li>
              <li><Text text="No transmission of private keys over networks" /></li>
              <li><Text text="Regular security audits of wallet code" /></li>
            </ul>
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="10. Children's Privacy" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Dojak Wallet is not intended for use by individuals under the age of 18. We do not knowingly collect information from children."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="11. Changes to Privacy Policy" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="We may update this privacy policy from time to time. Changes will be reflected in the wallet extension. Continued use after changes constitutes acceptance."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large }}>
            <Text text="12. Contact" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="For privacy-related questions, use github.com/jonheaven/dojak or dojak.app/privacy."
              style={{ marginBottom: spacing.medium }}
            />
          </div>

          <div style={{ marginBottom: spacing.large, marginTop: spacing.extraLarge, padding: spacing.medium, background: 'rgba(255, 255, 255, 0.06)', borderRadius: '8px' }}>
            <Text text="Your Privacy Matters" preset="bold" size="md" style={{ marginBottom: spacing.small }} />
            <Text 
              text="Remember: Dojak Wallet is designed with privacy in mind. We can't access your funds or personal information because we never collect it. You are in complete control."
              style={{ fontStyle: 'italic' }}
            />
          </div>
        </div>
      </Content>
    </Layout>
  );
}
