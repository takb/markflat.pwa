import showdown, {Converter, type ConverterOptions, type ShowdownExtension} from 'showdown';

interface MarkflatOptions extends ConverterOptions {
    mbStyle?: string;
    mbTransposeBy?: number;
    mbTranspose?: (key: string, transposeBy: number) => string;
    mbAddStyle?: boolean;
    mbAddMinorChordMarker?: boolean;
    useUnicodeAccidentals?: boolean;
}

showdown.extension('markflat', (): ShowdownExtension[] => {
    var artist = {
        type: 'lang',
        regex: /(# .*?)\s-\s(.*)$/mg,
        replace: '$1<span class="mb-artist">$2</span>'
    };
    var elements = {
        type: 'lang',
        filter: function (text: string, converter: Converter, options?: MarkflatOptions) {
            return text.replace(/~(.*?)[ \t]+([\s\S ]*?)(?=~|^\d+\. |^$)/mg, function(_match, block, content) {
                var ret = '<ul><li list="'+block+'">'+converter.makeHtml(content).replace(/<\/?p>/g, '')+'</li></ul>';
                return ret;
            });
        }
    };
    var chords = {
        type: 'lang',
        filter: function (text: string, _converter: Converter, options?: MarkflatOptions) {
            return text.replace(/\{(.+?)\}(.)/g, function(_match: string, p1: string, p2: string) {
                var chord = p1.replace(/^([a-gA-G][#b]?m?)(.*?)(?:\/([a-gA-G][#b]?))?$/g, function(_match, key = '', modifier = '', bass = '') {
                    if (options && typeof options.mbTranspose == 'function' && options.mbTransposeBy != undefined && options.mbTransposeBy != 0) {
                        key = options.mbTranspose(key, options.mbTransposeBy);
                        bass = options.mbTranspose(bass, options.mbTransposeBy);
                    }
                    key = options && options.mbAddMinorChordMarker ? key.replace(/^([a-g][#b]?(?!m))$/, '$1'.toUpperCase()+'m') : key;
                    if (options && options.useUnicodeAccidentals)
                        key = key.replace(/#/g, '\u266F').replace(/(?!^)b/g, '\u266D');
                    modifier = modifier.replace(/(\d+)\+/g, 'maj$1').replace(/^.(2|4)$/g, 'sus$1');//.replace(/#/g, '\u266F').replace(/b/g, '\u266D');
                    if (options && options.useUnicodeAccidentals)
                        bass = bass.replace(/#/g, '\u266F').replace(/([a-gA-G])b/g, '$1\u266D');
                    return key+(modifier ? '<sup>'+modifier+'</sup>' : '')+(bass ? '<sub>/'+bass+'</sub>' : '');
                });
                var base = (p2 != '.') ? p2.replace(' ', '&nbsp;&nbsp;&nbsp;') : '';
                return base ? '<span class="mb-ca"><span class="mb-chord">'+chord+'</span>'+base+'</span>' : '<span class="mb-chord-inline">'+chord+'</span>';
            })
            .replace(/\{(\.\.\.|:?\|\|?:?|')\}([a-zA-Z ]|_[a-zA-Z ]_|\.|$)/g, function (_match, tag, base) {
                base = (base != '.') ? base.replace(' ', '&nbsp;&nbsp;&nbsp;') : '';
                return base ? '<span class="mb-ca"><span class="mb-chord">'+tag+'</span>'+base+'</span>' : '<span class="mb-chord-inline">…</span>';
            });
            // .replace(/\{(\.\.\.|:?\|\|?:?|')\}([a-zA-Z ]|_[a-zA-Z ]_|\.|$)/g, function (match, tag, p2) {
            //   var base = (base != '.') ? p2.replace(' ', '&nbsp;&nbsp;&nbsp;') : '';
            //   return base ? '<span class="mb-ca"><span class="mb-chord">'+tag+'</span>'+base+'</span>' : '<span class="mb-chord-inline">…</span>';
            // });
        }
    };
    var styling: ShowdownExtension = {
        type: 'output',
        filter: function (text: string, _converter: Converter, options?: MarkflatOptions) {
            return (options?.mbAddStyle ? options.mbStyle : "") + text.replace(/<li(.*?)>([\s\S]*?)<\/li>/g, function (_match, tag, content) {
                var addClass = content.match(/class="mb-ca"/) ? ' class="mb-has-chords"' : '';
                return '<li'+addClass+tag+'>'+content+'</li>';
            });
        }
    };
    return [artist, elements, chords, styling];
});

showdown.setOption('mbTransposeBy', 0)
showdown.setOption('mbTranspose', function(key: string, transposeBy: number): string {
        if (key && transposeBy != undefined && transposeBy != 0) {
            var isMinor = key.match(/^[a-g]/);
            var scale = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
            if (key.length > 1 && key[key.length - 1] == 'b') {
                scale = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
            }
            key = key.length > 1 ? key[0].toUpperCase() + key.substring(1, key.length - 1) : key.toUpperCase();
            if (scale.indexOf(key) >= 0) {
                var i = (scale.indexOf(key) + transposeBy) % scale.length;
                key = scale[ i < 0 ? i + scale.length : i ];
                if (isMinor) {
                    key = key.toLowerCase();
                }
            }
        }
        return key;
    });
showdown.setOption('useUnicodeAccidentals', false);
showdown.setOption('mbAddMinorChordMarker', false);
showdown.setOption('mbAddStyle', true);
showdown.setOption('mbStyle', `<style>
    .mb {
      position: relative;
    }
    .mb h1 {
        font-size: 1.2em;
        font-weight: bold;
        margin: 0 0 0.5em 1em;
        padding: 0.2em 0;
    }
    .mb-artist {
      float: right;
      font-size: 0.9em;
      margin-right: 1em;
    }
    .mb ol {
      list-style: decimal;
    }
    .mb ul {
      list-style: none;
    }
    .mb ul, ol {
      margin: 0;
      padding: 0 0 0 5em;
    }
    .mb ul li, .mb ol li {
      margin: 0 0 0.6em 0;
      padding-left: 0.4em;
      line-height: 1.2em;
    }
    .mb ul li::marker {
      content: attr(list) ' ';
      text-align: right;
    }
    .mb ul li::marker, .mb ol li::marker {
      margin-right: 0.5em;
    }
    .mb-has-chords {
      line-height: 1.9em !important;
    }
    .mb-ca {
      position: relative;
    }
    .mb-chord {
      position: absolute;
      font-size: 0.9em;
      bottom: 0.6em;
    }
    .mb-chord, .mb-chord-inline {
      font-weight: bold;
      white-space: nowrap;
    }
    .mb-chord sup {
      font-size: 0.6em;
    }
    .mb em {
      font-style: normal;
      text-decoration: underline;
    }
  </style>`);

export default showdown