/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {
  FirebaseAppConfig,
  FirebaseOptions,
  MockFirebaseApp,
  MockFirebaseFirestore,
  MockFirebaseNamespace,
} from '@firebase/app-types';
import { _FirebaseNamespace, FirebaseAppInternals, FirebaseService } from '@firebase/app-types/private';
import { deepCopy, deepExtend } from '@firebase/util';
import { DEFAULT_ENTRY_NAME } from '../app';
import { MockFirebaseFirestoreImpl } from '../firestore';

// An array to capture listeners before the true auth functions  exist
let tokenListeners: any[] = [];
/**
 * Global context object for a collection of services using
 * a shared authentication state.
 */
export class MockFirebaseAppImpl implements MockFirebaseApp {
  get automaticDataCollectionEnabled(): boolean {
    this.checkDestroyed_();
    return this._automaticDataCollectionEnabled;
  }

  set automaticDataCollectionEnabled(val) {
    this.checkDestroyed_();
    this._automaticDataCollectionEnabled = val;
  }

  get name(): string {
    this.checkDestroyed_();
    return this.name_;
  }

  set name(value: string) {
    this.name_ = value;
  }

  get options(): FirebaseOptions {
    this.checkDestroyed_();
    return this.options_;
  }

  set options(value: FirebaseOptions) {
    this.options_ = value;
  }

  public INTERNAL: FirebaseAppInternals;
  private options_: FirebaseOptions;
  private name_: string;
  private isDeleted_ = false;
  private services_: {
    [name: string]: {
      [serviceName: string]: FirebaseService;
    };
  } = {};

  private _automaticDataCollectionEnabled: boolean;

  private _firestore: MockFirebaseFirestoreImpl;

  public firestore = (): MockFirebaseFirestore => {
    return this._firestore;
  }

  constructor(
    options: FirebaseOptions,
    config: FirebaseAppConfig = {},
    // tslint:disable-next-line
    private firebase_: MockFirebaseNamespace,
  ) {
    this.name_ = config.name!;
    this._automaticDataCollectionEnabled = config.automaticDataCollectionEnabled || false;
    this.options_ = deepCopy<FirebaseOptions>(options);
    this._firestore = new MockFirebaseFirestoreImpl(this);

    this.INTERNAL = {
      getUid: () => null,
      getToken: () => Promise.resolve(null),
      addAuthTokenListener: (callback: (token: string | null) => void) => {
        tokenListeners.push(callback);
        // Make sure callback is called, asynchronously, in the absence of the auth module
        setTimeout(() => callback(null), 0);
      },
      removeAuthTokenListener: (callback: (token: string | null) => void) => {
        tokenListeners = tokenListeners.filter(listener => listener !== callback);
      },
    };
  }

  public delete(): Promise<void> {
    return new Promise(resolve => {
      this.checkDestroyed_();
      resolve();
    })
      .then(() => {
        ((this.firebase_ as any) as _FirebaseNamespace).INTERNAL.removeApp(this.name_);
        const services: FirebaseService[] = [];
        Object.keys(this.services_).forEach(serviceKey => {
          Object.keys(this.services_[serviceKey]).forEach(instanceKey => {
            services.push(this.services_[serviceKey][instanceKey]);
          });
        });
        return Promise.all(
          services.map(service => {
            return service.INTERNAL!.delete();
          })
        );
      })
      .then(
        (): void => {
          this.isDeleted_ = true;
          this.services_ = {};
        }
      );
  }

  /**
   * Return a service instance associated with this app (creating it
   * on demand), identified by the passed instanceIdentifier.
   *
   * NOTE: Currently storage is the only one that is leveraging this
   * functionality. They invoke it by calling:
   *
   * ```javascript
   * firebase.app().storage('STORAGE BUCKET ID')
   * ```
   *
   * The service name is passed to this already
   * @internal
   */
  public _getService(name: string, instanceIdentifier: string = DEFAULT_ENTRY_NAME): FirebaseService {
    this.checkDestroyed_();

    if (!this.services_[name]) {
      this.services_[name] = {};
    }

    if (!this.services_[name][instanceIdentifier]) {
      /**
       * If a custom instance has been defined (i.e. not '[DEFAULT]')
       * then we will pass that instance on, otherwise we pass `null`
       */
      const instanceSpecifier = instanceIdentifier !== DEFAULT_ENTRY_NAME ? instanceIdentifier : undefined;
      const service = ((this.firebase_ as any) as _FirebaseNamespace).INTERNAL.factories[name](
        this,
        this.extendApp.bind(this),
        instanceSpecifier
      );
      this.services_[name][instanceIdentifier] = service;
    }

    return this.services_[name][instanceIdentifier];
  }

  /**
   * Callback function used to extend an App instance at the time
   * of service instance creation.
   */
  private extendApp(props: { [name: string]: any }): void {
    // Copy the object onto the FirebaseAppImpl prototype
    deepExtend(this, props);

    /**
     * If the app has overwritten the addAuthTokenListener stub, forward
     * the active token listeners on to the true fxn.
     *
     * TODO: This function is required due to our current module
     * structure. Once we are able to rely strictly upon a single module
     * implementation, this code should be refactored and Auth should
     * provide these stubs and the upgrade logic
     */
    if (props.INTERNAL && props.INTERNAL.addAuthTokenListener) {
      tokenListeners.forEach(listener => {
        this.INTERNAL.addAuthTokenListener(listener);
      });
      tokenListeners = [];
    }
  }

  /**
   * This function will throw an Error if the App has already been deleted -
   * use before performing API actions on the App.
   */
  private checkDestroyed_(): void {
    if (this.isDeleted_) {
      // tslint:disable-next-line
      console.error('app-deleted', { name: this.name_ });
    }
  }
}
// Prevent dead-code elimination of these methods w/o invalid property
// copying.
// tslint:disable-next-line: no-unused-expression
(MockFirebaseAppImpl.prototype.name && MockFirebaseAppImpl.prototype.options) ||
  MockFirebaseAppImpl.prototype.delete ||
  // tslint:disable-next-line: no-console
  console.log('dc');
