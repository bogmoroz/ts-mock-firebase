import { MockFirebaseApp } from 'firebaseApp';

describe('Firestore references', () => {
  describe('Collection References', () => {
    it('Will return a reference to collection', () => {
      const app = new MockFirebaseApp();

      const firestore = app.firestore();
      const ref = firestore.collection('users');
      expect(ref).toBeDefined();
    });

    describe('Reference paths', () => {
      it('Collections has equal path', () => {
        const app = new MockFirebaseApp();

        const firestore = app.firestore();
        const ref = firestore.collection('company/mindhive/users');
        expect(ref.path).toMatch('company/mindhive/users');
      });

      it('Documents has equal path', () => {
        const app = new MockFirebaseApp();

        const firestore = app.firestore();
        const ref = firestore.doc('company/mindhive/users/ville');
        expect(ref.path).toMatch('company/mindhive/users/ville');
      });
    });
  });
});
