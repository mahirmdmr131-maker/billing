import { db } from '../firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, where } from 'firebase/firestore';
import { Sale, AppData } from '../types';

export const syncSaleToFirestore = async (sale: Sale) => {
  try {
    await setDoc(doc(db, 'sales', sale.id), {
      ...sale,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    console.error('Error syncing sale to Firestore:', error);
  }
};

export const listenToSales = (callback: (sales: Sale[]) => void) => {
  const q = query(collection(db, 'sales'));
  return onSnapshot(q, (snapshot: any) => {
    const sales: Sale[] = [];
    snapshot.forEach((doc: any) => {
      sales.push(doc.data() as Sale);
    });
    callback(sales);
  }, (error: any) => {
    console.error('Firestore Error: ', error);
  });
};
