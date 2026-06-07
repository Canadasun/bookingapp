import 'react-native-gesture-handler'; // must be the first import for gesture handling to work

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App).
// It also ensures the environment is set up correctly whether the app is loaded
// in Expo Go or in a native (EAS) build.
registerRootComponent(App);
