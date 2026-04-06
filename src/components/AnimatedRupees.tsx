import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { formatRupeesFull } from '../utils/format';

type Props = {
  value: number;
  maskNumbers?: boolean;
  className?: string;
};

export function AnimatedRupees({ value, maskNumbers = false, className }: Props) {
  const animated = useAnimatedNumber(value, !maskNumbers);
  if (maskNumbers) {
    return <span className={className}>***</span>;
  }
  const settled = Math.abs(animated - value) < 0.01;
  const displayVal = settled ? value : Math.round(animated);
  return <span className={className}>{formatRupeesFull(displayVal)}</span>;
}
