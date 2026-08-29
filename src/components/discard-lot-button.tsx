'use client';

import { useActionState, useEffect } from 'react';
import { discardLotAction, type DiscardState } from '@/lib/actions/lots';
import { useToast } from '@/components/toast';

export function DiscardLotButton({ lotId }: { lotId: string }) {
  const { showToast } = useToast();
  const [state, formAction, pending] = useActionState<DiscardState, FormData>(discardLotAction, {});

  useEffect(() => {
    if (state.success) showToast(state.success);
    if (state.error) showToast(state.error);
  }, [state.success, state.error, showToast]);

  return (
    <form action={formAction}>
      <input type="hidden" name="lotId" value={lotId} />
      <button type="submit" disabled={pending} className="gg-btn gg-btn-ghost !py-2 !px-3 !text-[12px] !min-h-[36px]">
        {pending ? 'กำลังบันทึก…' : 'บันทึกทิ้งล็อตนี้'}
      </button>
    </form>
  );
}
