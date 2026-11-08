import asyncio, os, sys, json
from playwright.async_api import async_playwright
HIER=os.path.dirname(os.path.abspath(__file__))
APP=os.path.join(HIER,'..')
W=os.environ.get('MEDSCAN_TESTDATA', os.path.join(HIER,'..','..','testdata','barcodes'))
OUT=os.environ.get('MEDSCAN_OUT', W)  # screenshots
NM=os.environ.get('ZXING_DIST','node_modules/zxing-wasm/dist')  # npm i zxing-wasm@3.1.6 BUITEN deze map
ZJS=os.environ.get('ZXING_JS','node_modules/@zxing/library/umd/index.min.js')  # npm i @zxing/library@0.21.3
CSP=os.environ.get('MODUS')=='csp'  # simuleert claude.ai: wasm ophalen geblokkeerd
async def main():
    async with async_playwright() as p:
        Y4M=os.environ.get('LIVE_Y4M')  # optioneel: nepcamera (y4m-video van een doosje) om live scannen te testen
        args=['--no-sandbox']+(['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+Y4M] if Y4M else [])
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=args)
        ctx=await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, ignore_https_errors=True, permissions=['camera'])
        page=await ctx.new_page()
        logs=[]; page.on('console', lambda m: logs.append(m.type+': '+m.text)); page.on('pageerror', lambda e: logs.append('PAGEERROR '+str(e)))
        async def cdn(route):
            u=route.request.url
            if '@zxing/library' in u: await route.fulfill(path=ZJS, content_type='application/javascript')
            elif '/jspdf@' in u: await route.fulfill(path=os.environ.get('JSPDF','node_modules/jspdf/dist/jspdf.umd.min.js'), content_type='application/javascript')
            elif '/jspdf-autotable@' in u: await route.fulfill(path=os.environ.get('JSPDF_AT','node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js'), content_type='application/javascript')
            elif u.endswith('index.js'): await route.fulfill(path=NM+'/iife/reader/index.js', content_type='application/javascript')
            elif u.endswith('.wasm'): await route.fulfill(path=NM+'/reader/zxing_reader.wasm', content_type='application/wasm')
            else: await route.abort()
        await page.route('https://cdn.jsdelivr.net/**', cdn)
        async def local(route):
            path=route.request.url.split('https://app.test/')[1].split('?')[0] or 'index.html'
            hdr={'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'"} if CSP else {}
            await route.fulfill(path=os.path.join(APP,path), headers=hdr)
        await page.route('https://app.test/**', local)
        await page.goto('https://app.test/index.html'); await page.wait_for_timeout(800)
        await page.fill('#ctx-egfr','40'); await page.click('#btn-start')
        async def foto(f):
            await page.set_input_files('#foto-galerij', os.path.join(W,f)); await page.wait_for_selector('#bezig', state='hidden', timeout=30000); await page.wait_for_timeout(200)
        # 1 realistische foto: onbekend -> koppelen
        await foto('foto4_klein.jpg' if CSP else 'foto_coversyl.jpg')
        assert await page.is_visible('#s-zoek'), 'zoekscherm verwacht; melding: '+ (await page.inner_text('#scan-melding'))
        await page.screenshot(path=OUT+'/ui_1_koppel.png')
        await page.fill('#zoek-invoer','cover'); await page.click('#zoek-resultaten li >> nth=0')
        assert await page.is_visible('#s-dosering')
        await page.click('#dos-schema button[data-m="o"][data-d="0.5"]')
        await page.fill('#dos-sterkte','5 mg')
        await page.screenshot(path=OUT+'/ui_2_dosering.png')
        await page.click('#btn-dos-opslaan')
        # 2 zelfde product nog eens (ander serienummer, zelfde GTIN) -> samenvoegen
        await foto('dm_coversyl2.png')
        assert len((await page.evaluate('window.__medscan.sessie().items')))==1
        # 3 aldactone onbekend -> koppelen
        await foto('dm_aldactone.png'); await page.fill('#zoek-invoer','spirono'); await page.click('#zoek-resultaten li >> nth=0')
        await page.click('#dos-schema button[data-m="o"][data-d="0.5"]'); await page.click('#btn-dos-opslaan')
        # 4 brufen vervallen
        await foto('dm_brufen_vervallen.png'); await page.fill('#zoek-invoer','brufen'); await page.click('#zoek-resultaten li >> nth=0')
        await page.click('#dos-zonodig'); await page.click('#dos-inname button[data-w="onduidelijk"]'); await page.click('#btn-dos-opslaan')
        # 5 EAN ledertrexate, dagelijks
        await foto('ean_ledertrexate.png'); await page.fill('#zoek-invoer','ledertrex'); await page.click('#zoek-resultaten li >> nth=0')
        await page.click('#dos-schema button[data-m="o"][data-d="0.5"]'); await page.click('#btn-dos-opslaan')
        # 6 manueel: lasix
        await page.click('#btn-zoek'); await page.fill('#zoek-invoer','lasix'); await page.click('#zoek-resultaten li >> nth=0')
        await page.click('#dos-schema button[data-m="o"][data-d="0.5"]'); await page.click('#btn-dos-opslaan')
        await page.screenshot(path=OUT+'/ui_3_lijst.png', full_page=True)
        # tweede keer coversyl: nu gekend -> direct dosering
        await page.click('#btn-afronden'); await page.wait_for_timeout(200)
        await page.screenshot(path=OUT+'/ui_4_overzicht.png', full_page=True)
        ws=await page.eval_on_selector_all('#ov-waarschuwingen li .w-kop','els=>els.map(e=>e.textContent)')
        print('WAARSCHUWINGEN', ws)
        print(await page.input_value('#ov-tekst'))
        await page.click('#ov-waarschuwingen li >> nth=0 >> .duimen button >> nth=0')
        async with page.expect_download() as dl:
            await page.click('#btn-pdf')
        pdfpad=os.path.join(OUT,'test_medicatieschema.pdf'); await (await dl.value).save_as(pdfpad)
        print('PDF OK', os.path.getsize(pdfpad), 'bytes')
        await page.click('#btn-afsluiten'); await page.click('#dialoog-ja'); await page.wait_for_timeout(300)
        print('LOG', await page.evaluate('localStorage.getItem("medscan.log.v1")'))
        print('TABEL', await page.evaluate('Object.keys(JSON.parse(localStorage.getItem("medscan.gtin.v1")))'))
        # nieuwe sessie: gekende barcode
        await page.click('#btn-start'); await foto('dm_coversyl.png')
        assert await page.is_visible('#s-dosering'), 'gekende barcode moet direct naar dosering'
        await page.click('#btn-dos-annuleer')
        # Echte foto van een doosje: dot-DataMatrix, zilver op zwart (enkel de wasm-lezer kan dit)
        echt=os.path.join(W,'echt_dot_datamatrix_zilver_op_zwart.jpg')
        if os.path.exists(echt):
            await page.set_input_files('#foto-galerij', echt); await page.wait_for_selector('#bezig', state='hidden', timeout=60000); await page.wait_for_timeout(200)
            ok = await page.is_visible('#s-dosering') and 'Forxiga' in await page.inner_text('#dos-naam')
            print('ECHTE FOTO (dot-DataMatrix):', ('gelezen + herkend via SAM: '+await page.inner_text('#dos-naam')+' | '+await page.inner_text('#dos-stoffen')) if ok else 'NIET gelezen: '+await page.inner_text('#scan-melding'))
            if not CSP: assert ok
            if ok: await page.screenshot(path=OUT+'/ui_5_sam.png'); await page.click('#btn-dos-annuleer')
        live = await page.evaluate('Lezer.liveMogelijk()')
        print('live mogelijk:', live)
        if Y4M and live and not CSP:
            await page.click('#btn-scan'); await page.wait_for_selector('#s-dosering', state='visible', timeout=20000)
            assert 'Forxiga' in await page.inner_text('#dos-naam'); print('LIVE SCAN OK (Forxiga via SAM)')
        print('\n'.join(l for l in logs if 'error' in l.lower() or 'PAGEERROR' in l))
        print('motor:', await page.evaluate('Lezer.motor()')); print('UI TEST OK', 'CSP' if CSP else 'normaal')
        await b.close()
asyncio.run(main())
