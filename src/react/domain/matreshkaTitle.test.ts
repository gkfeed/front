import { describe, expect, it } from 'vitest';

import { parseMatreshkaTitle } from './matreshkaTitle';

describe('parseMatreshkaTitle', () => {
  it('separates the channel from the video title', () => {
    expect(parseMatreshkaTitle(
      'Видео канала Стас Ай как дорого - Защищаю Братишкина от уставшего дедпи47',
    )).toEqual({
      channel: 'Стас Ай как дорого',
      title: 'Защищаю Братишкина от уставшего дедпи47',
    });
  });

  it('supports different dash characters and keeps dashes in the video title', () => {
    expect(parseMatreshkaTitle('Видео канала Канал — Название — часть 2')).toEqual({
      channel: 'Канал',
      title: 'Название — часть 2',
    });
  });

  it('removes the Matreshka site tagline from parser titles', () => {
    expect(parseMatreshkaTitle(
      'МатрёшкаТВ — дом для видеоавторов и их сообществ - БОДИ ПОЗИТИВ НА ДИКОМ ЗАПАДЕ',
    )).toEqual({
      channel: 'МатрёшкаТВ',
      title: 'БОДИ ПОЗИТИВ НА ДИКОМ ЗАПАДЕ',
    });
  });

  it('falls back to the feed text for an unformatted title', () => {
    expect(parseMatreshkaTitle('Video', 'Readable video title')).toEqual({
      channel: null,
      title: 'Readable video title',
    });
  });
});
