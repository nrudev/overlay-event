import { chromium, type Browser, type Page } from 'playwright';

const ROULETTE_URL = 'https://lazygyu.github.io/roulette/';

export class RouletteAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async ensureOpen(): Promise<void> {
    if (this.page && !this.page.isClosed()) return;

    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext({ viewport: { width: 1280, height: 800 } });
    this.page = await context.newPage();
    await this.page.goto(ROULETTE_URL, { waitUntil: 'domcontentloaded' });

    await this.page.waitForFunction(() => Boolean((window as any).roulette?.isReady), null, {
      timeout: 15000,
    });

    // 페이지 자체의 UI 스크립트가 로드 직후 기본 데모 이름(수박/키위/귤)을 자동으로
    // 채워 넣는 시점과 우리 주입이 겹치면 우리 쪽이 먼저 실행되어도 곧바로 덮어써질 수 있다.
    // 초기화가 안정되도록 잠깐 기다린다.
    await this.page.waitForTimeout(1500);
  }

  async injectNames(names: string[]): Promise<void> {
    await this.ensureOpen();
    if (!this.page) throw new Error('룰렛 페이지가 열려있지 않습니다.');
    if (names.length === 0) throw new Error('명단이 비어 있습니다.');

    const page = this.page;
    const setAndCount = () =>
      page.evaluate((marbleNames) => {
        (window as any).roulette.setMarbles(marbleNames);
        return (window as any).roulette.getCount();
      }, names);

    let count = await setAndCount();
    // 사이트의 자체 초기화 스크립트가 뒤늦게 기본값으로 덮어쓰는 경우를 대비해 재확인 후 재주입한다.
    for (let attempt = 0; attempt < 3 && count !== names.length; attempt++) {
      await page.waitForTimeout(400);
      count = await setAndCount();
    }

    if (count !== names.length) {
      throw new Error('룰렛 페이지에 명단을 반영하지 못했습니다 (구슬 수 불일치). 다시 시도해주세요.');
    }
  }

  async triggerStart(): Promise<void> {
    if (!this.page) throw new Error('룰렛 페이지가 열려있지 않습니다.');

    await this.page.evaluate(() => {
      (window as any).roulette.start();
    });
  }

  async close(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
    this.page = null;
  }
}
