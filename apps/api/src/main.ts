import 'reflect-metadata';

import { appConfig } from './config/env';
import { createApp } from './app.factory';

const bootstrap = async () => (await createApp()).listen(appConfig.PORT, '0.0.0.0');

void bootstrap();
