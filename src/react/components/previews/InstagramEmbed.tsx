type InstagramEmbedProps = {
  src: string;
  title: string;
};

export function InstagramEmbed({ src, title }: InstagramEmbedProps) {
  return (
    <div className="reader-card__preview reader-card__preview--short-video reader-card__preview--instagram">
      <iframe
        src={src}
        title={title}
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}
