import * as SDK from 'azure-devops-extension-sdk';
import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { SbomInventoryPage } from './components/SbomInventoryPage';
import './sbom-report-tab.scss';

export class Root extends React.Component<{}, {}> {
  public componentDidMount() {
    try {
      console.info('Initializing SDK...');
      SDK.init();
      SDK.ready()
        .then(() => {
          console.info('SDK is ready');
        })
        .catch((error) => {
          console.error('SDK ready failed', error);
        });
    } catch (error) {
      console.error('Error during SDK initialization', error);
    }
  }

  public render(): JSX.Element {
    return <SbomInventoryPage />;
  }
}

ReactDOM.render(<Root />, document.getElementById('root'));
