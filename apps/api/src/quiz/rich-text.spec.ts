import {
  escapeHtml,
  hasFormatting,
  HIGHLIGHT_COLORS,
  richTextToPlain,
  RICH_TEXT_SIZES,
  sanitizeRichText,
} from "@ekulmis/shared";

/**
 * A question is written by one school and rendered in every student's browser.
 *
 * That is the whole reason this is careful. Anything that survives into a
 * stored question runs in the session of every child who sits the paper, and
 * on a multi-tenant system that session belongs to a different school from
 * the one that wrote it. So the test is not "does the obvious attack fail"
 * but "does anything at all other than the handful of allowed things get
 * through" — which is the property re-serialising gives, and which these
 * check from both directions.
 */

describe("what a teacher is allowed to do", () => {
  it("keeps bold, italic, underline and a highlight", () => {
    expect(sanitizeRichText("<b>bold</b>")).toBe("<b>bold</b>");
    expect(sanitizeRichText("<i>x</i><em>y</em>")).toBe("<i>x</i><em>y</em>");
    expect(sanitizeRichText("<u>under</u>")).toBe("<u>under</u>");
    expect(sanitizeRichText("<mark>hi</mark>")).toBe("<mark>hi</mark>");
  });

  it("keeps a highlight on a single letter, which is the point", () => {
    // A tajwiid paper marks one letter of a word, not the word.
    const html = sanitizeRichText(
      'ال<span style="background-color:#fef08a">ح</span>مد',
    );
    expect(html).toContain('background-color:#fef08a');
    expect(richTextToPlain(html)).toBe("الحمد");
  });

  it("keeps a size and a face", () => {
    const html = sanitizeRichText(
      '<span style="font-size:150%;font-family:Amiri">verse</span>',
    );
    expect(html).toContain("font-size:150%");
    expect(html).toContain("font-family:Amiri");
  });

  it("converts a pasted pixel or em size into a relative one", () => {
    // Absolute sizes pin the question to the teacher's screen; the same
    // question then arrives tiny on a projector and huge on a phone.
    expect(sanitizeRichText('<span style="font-size:32px">x</span>')).toContain(
      "font-size:200%",
    );
    expect(sanitizeRichText('<span style="font-size:1.5em">x</span>')).toContain(
      "font-size:150%",
    );
  });

  it("refuses a size no screen can use", () => {
    expect(sanitizeRichText('<span style="font-size:4000%">x</span>')).toBe(
      "<span>x</span>",
    );
    expect(sanitizeRichText('<span style="font-size:1%">x</span>')).toBe(
      "<span>x</span>",
    );
  });

  it("keeps line breaks, and flattens a pasted block into one", () => {
    expect(sanitizeRichText("a<br>b")).toBe("a<br>b");
    expect(sanitizeRichText("<div>a</div><div>b</div>")).toBe("a<br>b");
  });
});

describe("what no question may contain", () => {
  const attacks: [string, string][] = [
    ["a script", '<script>alert(1)</script>'],
    ["a script with attributes", '<script src="//evil.example/x.js"></script>'],
    ["an inline handler", '<b onclick="steal()">x</b>'],
    ["a handler with no quotes", "<b onmouseover=steal()>x</b>"],
    ["an image error handler", '<img src=x onerror="alert(1)">'],
    ["an iframe", '<iframe src="//evil.example"></iframe>'],
    ["an object", '<object data="//evil.example"></object>'],
    ["a form", '<form action="//evil.example"><input name="p"></form>'],
    ["a link", '<a href="javascript:alert(1)">click</a>'],
    ["a style block", "<style>body{display:none}</style>"],
    ["a svg handler", '<svg><animate onbegin="alert(1)"/></svg>'],
    ["a comment hiding markup", "<!--<script>alert(1)</script>-->"],
    ["a doctype", "<!DOCTYPE html><b>x</b>"],
    ["a meta refresh", '<meta http-equiv="refresh" content="0;url=//evil">'],
    ["a base tag", '<base href="//evil.example/">'],
  ];

  for (const [what, input] of attacks) {
    it(`strips ${what}`, () => {
      const out = sanitizeRichText(input);
      expect(out.toLowerCase()).not.toContain("<script");
      expect(out.toLowerCase()).not.toContain("<iframe");
      expect(out.toLowerCase()).not.toContain("<img");
      expect(out.toLowerCase()).not.toContain("<a ");
      expect(out.toLowerCase()).not.toContain("onerror");
      expect(out.toLowerCase()).not.toContain("onclick");
      expect(out.toLowerCase()).not.toContain("onmouseover");
      expect(out.toLowerCase()).not.toContain("onbegin");
      expect(out.toLowerCase()).not.toContain("javascript:");
      expect(out.toLowerCase()).not.toContain("http-equiv");
    });
  }

  it("keeps the words even when it drops the markup", () => {
    // A teacher who pasted from a website should get their text, not a blank.
    expect(richTextToPlain(sanitizeRichText('<a href="#">See page 4</a>'))).toBe(
      "See page 4",
    );
  });

  it("drops an attribute that is not style", () => {
    const out = sanitizeRichText(
      '<span class="x" id="y" data-z="1" style="color:red">t</span>',
    );
    expect(out).toBe('<span style="color:red">t</span>');
  });

  it("drops a css property that is not on the list", () => {
    const out = sanitizeRichText(
      '<span style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;color:red">t</span>',
    );
    // Covering the page with an element is not formatting a question.
    expect(out).toBe('<span style="color:red">t</span>');
  });

  it("drops a css value that reaches outside itself", () => {
    for (const value of [
      "url(//evil.example/x.png)",
      "expression(alert(1))",
      "\\75 rl(x)",
    ]) {
      const out = sanitizeRichText(`<span style="background-color:${value}">t</span>`);
      expect(out).toBe("<span>t</span>");
    }
  });

  it("drops a property smuggled in behind a semicolon", () => {
    // The colour is what was asked for and is kept; the property riding in
    // after it is not on the list and never reaches the output.
    const out = sanitizeRichText(
      '<span style="background-color:red;position:fixed">t</span>',
    );
    expect(out).toBe('<span style="background-color:red">t</span>');
    expect(out).not.toContain("position");
  });

  it("cannot break out of the element it is rendered into", () => {
    // Unbalanced input used to be the way out: an unclosed tag swallows
    // whatever the page puts after the question.
    expect(sanitizeRichText("<b>never closed")).toBe("<b>never closed</b>");
    expect(sanitizeRichText("</div></body><script>x</script>")).toBe("");
    expect(sanitizeRichText("<b>a</i></b>")).toBe("<b>a</b>");
    expect(sanitizeRichText("text with a stray < inside")).toBe(
      "text with a stray &lt; inside",
    );
  });

  it("treats a tag that never closes as text rather than losing it", () => {
    expect(sanitizeRichText("What is 3 < 5")).toBe("What is 3 &lt; 5");
  });

  it("escapes what it keeps as text", () => {
    expect(sanitizeRichText('5 > 3 & "yes"')).toBe("5 &gt; 3 &amp; &quot;yes&quot;");
    expect(escapeHtml("<b>")).toBe("&lt;b&gt;");
  });

  it("does not let a double pass decode its own escaping", () => {
    // Sanitising twice must not turn &lt;script&gt; back into a tag, or a
    // re-save of a stored question becomes the attack.
    const once = sanitizeRichText("<script>alert(1)</script>");
    expect(sanitizeRichText(once)).toBe(once);
    const text = sanitizeRichText("a &lt;b&gt; c");
    expect(sanitizeRichText(text).toLowerCase()).not.toContain("<b>");
  });

  it("refuses to nest without end", () => {
    const deep = "<span>".repeat(200) + "x" + "</span>".repeat(200);
    const out = sanitizeRichText(deep);
    expect((out.match(/<span/g) ?? []).length).toBeLessThanOrEqual(24);
    expect(out).toContain("x");
  });

  it("holds a question to a length", () => {
    const out = sanitizeRichText("a".repeat(50000));
    expect(out.length).toBeLessThanOrEqual(20000);
  });
});

describe("the words behind the formatting", () => {
  it("is what the paper is really asking", () => {
    expect(
      richTextToPlain('<b>What</b> is the <mark>capital</mark> of Somalia?'),
    ).toBe("What is the capital of Somalia?");
  });

  it("turns a break into a line", () => {
    expect(richTextToPlain("line one<br>line two")).toBe("line one\nline two");
  });

  it("gives back the characters, not the entities", () => {
    expect(richTextToPlain("5 &gt; 3 &amp; true")).toBe("5 > 3 & true");
    expect(richTextToPlain("a&nbsp;b")).toBe("a b");
  });

  it("leaves plain text alone", () => {
    expect(richTextToPlain("No formatting here")).toBe("No formatting here");
    expect(richTextToPlain(null)).toBe("");
  });

  it("knows when there is nothing worth storing", () => {
    expect(hasFormatting("plain question")).toBe(false);
    expect(hasFormatting("")).toBe(false);
    expect(hasFormatting("<b>bold</b>")).toBe(true);
    expect(hasFormatting('<span style="font-size:150%">x</span>')).toBe(true);
  });
});

describe("what the toolbar offers", () => {
  it("sizes a question relative to the screen it lands on", () => {
    // Absolute sizes look right on the teacher's laptop and wrong everywhere.
    for (const s of RICH_TEXT_SIZES) expect(s.id).toMatch(/^\d{2,3}%$/);
    expect(RICH_TEXT_SIZES.map((s) => s.id)).toContain("100%");
  });

  it("highlights in colours that survive a photocopier", () => {
    for (const c of HIGHLIGHT_COLORS) expect(c.id).toMatch(/^#[0-9a-f]{6}$/);
    expect(HIGHLIGHT_COLORS.length).toBeGreaterThanOrEqual(4);
  });

  it("produces something the sanitiser keeps", () => {
    // The toolbar and the sanitiser have to agree, or formatting silently
    // disappears on save and the teacher is told nothing.
    for (const s of RICH_TEXT_SIZES) {
      expect(sanitizeRichText(`<span style="font-size:${s.id}">x</span>`)).toContain(
        `font-size:${s.id}`,
      );
    }
    for (const c of HIGHLIGHT_COLORS) {
      expect(
        sanitizeRichText(`<span style="background-color:${c.id}">x</span>`),
      ).toContain(`background-color:${c.id}`);
    }
  });
});
