import { StyleSheet, View } from 'react-native';
import { formatDate } from '@/lib/format';
import { Avatar, Stars } from '~/components/ui/feedback';
import { Text } from '~/components/ui/text';
import type { ReviewWithAuthor } from '~/features/catalog/queries';

/** Reseña con la foto y el nombre corto de quien compró (como ReviewItem del web). */
export function ReviewItem({ review }: { review: ReviewWithAuthor }) {
  const name = review.author?.name || 'Cliente';
  return (
    <View style={styles.review}>
      <View style={styles.head}>
        <Avatar uri={review.author?.avatar_url} name={name} size={38} />
        <View style={styles.who}>
          <Text variant="smallMedium" numberOfLines={1}>
            {name}
          </Text>
          <Stars value={review.rating} size={14} />
        </View>
        <Text variant="small" tone="muted">
          {formatDate(review.created_at, false)}
        </Text>
      </View>
      {review.comment ? <Text variant="body">{review.comment}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  review: { gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  who: { flex: 1, gap: 2 },
});
