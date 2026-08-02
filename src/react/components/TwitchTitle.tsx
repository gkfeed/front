export function TwitchTitle({ text }: { text: string }) {
  return (
    <>
      {text.split(/([@!][\p{L}\p{N}_-]+)/gu).map((part, index) => {
        if (!/^[@!][\p{L}\p{N}_-]+$/u.test(part)) return part;
        const kind = part.startsWith('@') ? 'mention' : 'command';
        return (
          <span key={`${part}-${index}`} className={`reader-card__title-token reader-card__title-token--${kind}`}>
            {part}
          </span>
        );
      })}
    </>
  );
}
