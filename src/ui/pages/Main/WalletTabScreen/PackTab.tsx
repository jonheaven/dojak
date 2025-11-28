
import { Card } from '@/ui/components/Card';
import { Column } from '@/ui/components/Column';
import { Row } from '@/ui/components/Row';
import { Text } from '@/ui/components/Text';

export function FeelsTab() {
  return (
    <Column gap="lg">
      <Card preset="style2">
        <Column gap="md">
          <Text text="Feels Mesh Chat" color="gold" size="lg" weight="bold" />
          <Text
            text="Encrypted swarm chat is almost here. The Feels tab will iframe the mesh so you can share Doginals, Vepe clips, ecash tips, and Charms collectibles without ever leaving Dojak."
            color="textDim"
          />
          <Row>
            <Text
              text="Today this area is a staging pad: responsive, theme-matched, and ready for the iframe hook once the Feels relay endpoints are live."
              color="textDim"
            />
          </Row>
          <Row>
            <Text
              text="Coming soon: inline Doginal previews, Vepe video cards with captions/hashtags, Pepemap markers, and DNS handles so chats stay rich and verifiable."
              color="textDim"
            />
          </Row>
        </Column>
      </Card>
    </Column>
  );
}
