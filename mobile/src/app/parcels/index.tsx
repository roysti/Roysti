import { AuthGate } from '@/components/blocks';
import { ParcelList } from '@/components/ParcelList';

export default function ParcelsScreen() {
  return (
    <AuthGate>
      <ParcelList />
    </AuthGate>
  );
}
