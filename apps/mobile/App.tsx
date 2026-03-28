import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090B' }}>
      <View style={{ flex: 1, width: '100%', maxWidth: 402, alignSelf: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ color: 'white', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Dojak Mobile</Text>
        <Text style={{ color: '#A1A1AA', textAlign: 'center', marginTop: 8 }}>Expo + NativeWind scaffold ready for shared @dojak/ui components.</Text>
      </View>
      <StatusBar style="light" />
    </SafeAreaView>
  );
}
