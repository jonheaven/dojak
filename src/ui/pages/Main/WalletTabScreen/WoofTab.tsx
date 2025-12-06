import { Card } from '@/ui/components/Card';
import { Column } from '@/ui/components/Column';
import { Row } from '@/ui/components/Row';
import { Text } from '@/ui/components/Text';

export function WoofTab() {
  return (
    <Column gap="lg">
      <Card preset="style2">
        <Column gap="md">
          <Text text="Woof Mesh Chat" color="gold" size="lg" />
          <Text
            text="Encrypted swarm chat is almost here. The Woof tab will iframe the mesh so you can share Doginals, Vepe clips, ecash tips, and Charms collectibles without ever leaving Dojak."
            color="textDim"
          />
          <Row>
            <Text
              text="Today this area is a staging Fd: responsive, theme-matched, and ready for the iframe hook once the Woof relay endpoints are live."
              color="textDim"
            />
          </Row>
          <Row>
            <Text
              text="Coming soon: inline Doginal previews, Vepe video cards with captions/hashtags, Dogemap markers, and DNS handles so chats stay rich and verifiable."
              color="textDim"
            />
          </Row>
        </Column>
      </Card>
    </Column>
  );
}
