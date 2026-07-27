# 엑셀 원본 재계산으로 골든 기대값 만들기

앱의 계산 결과를 **엑셀 원본이 실제로 내놓는 값**과 대조하기 위한 절차다.
워크북에 캐시된 값은 마지막으로 조회한 사번 것뿐이라, 다른 사번으로 검증하려면
LibreOffice Calc 로 직접 재계산해야 한다.

엑셀 수식이 바뀔 때마다 이 절차로 `tests/fixtures/expected-demo02.json` 을 다시 만든다.

---

## 1. LibreOffice Calc 설치

```bash
apt-get update -q && apt-get install -y libreoffice-calc
```

> `libreoffice-core` 만 있으면 xlsx 를 **아예 못 연다** (`Error: source file could not be loaded`).
> 반드시 `libreoffice-calc` 가 필요하다.

## 2. 조회 사번 바꾸기

`레포트!N6` 이 입력 셀이다 (`개요!AL13` 이 이 셀을 배열 수식으로 참조한다).
openpyxl 로 저장하면 수식이 망가질 수 있으므로 **zip 안의 XML 만 직접 손본다.**

```python
import zipfile, re
src, dst = '원본.xlsx', 'in.xlsx'
zin = zipfile.ZipFile(src)
# workbook.xml.rels 에서 '레포트' 시트의 실제 파일 경로를 찾는다
target = 'xl/worksheets/sheet3.xml'          # ← 파일마다 다르므로 반드시 확인
s = zin.read(target).decode()
m = re.search(r'<c r="N6"[^>]*>.*?</c>|<c r="N6"[^>]*/>', s, re.S)
s = s[:m.start()] + '<c r="N6" t="inlineStr"><is><t>1B9137</t></is></c>' + s[m.end():]
zout = zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED)
for n in zin.namelist():
    zout.writestr(n, s.encode() if n == target else zin.read(n))
zout.close()
```

## 3. 강제 재계산 설정

LibreOffice 는 기본적으로 xlsx 를 열 때 **재계산하지 않고 캐시값을 그대로 둔다.**
프로필을 한 번 만든 뒤 설정을 주입한다.

```bash
PROF=file://$PWD/prof
soffice --headless --norestore -env:UserInstallation=$PROF --convert-to xlsx in.xlsx --outdir /tmp/warmup
```

`prof/user/registrymodifications.xcu` 의 `</oor:items>` 앞에 추가:

```xml
<item oor:path="/org.openoffice.Office.Calc/Formula/Load">
  <prop oor:name="OOXMLRecalcMode" oor:op="fuse"><value>0</value></prop>
</item>
```

`0` = 항상 재계산, `1` = 재계산 안 함(기본), `2` = 사용자에게 물어봄.

## 4. 재계산 실행

```bash
soffice --headless --norestore -env:UserInstallation=$PROF --convert-to xlsx --outdir out in.xlsx
```

`out/in.xlsx` 의 `레포트!F6`(성명)이 새 사번의 것으로 바뀌었는지 반드시 확인한다.
안 바뀌었으면 3번 설정이 먹지 않은 것이다.

## 5. 기대값 추출

`tests/golden.test.ts` 가 참조하는 셀 목록대로 뽑아
`tests/fixtures/expected-demo02.json` 에 `{"시트!셀": 값}` 형태로 저장한다.

## 6. 픽스처의 신원 필드 익명화

픽스처와 기대값 모두 저장소에 커밋되므로 **사번·성명·입사일자·소속을 반드시 치환**한다.
수치는 원본 그대로 두어야 검증력이 유지된다.

| 필드 | 치환값 |
|---|---|
| code | `demo02` |
| name / repName | `홍길동` |
| hireDate | `20200101` |
| hq / visionCenter / branch | `샘플본부` / `샘플비전센터` / `샘플지점` |
| branchCode / officeCode | `0X0000` |

기대값 JSON 의 `레포트!B6/C6/D6/F6/I6` 도 같은 값으로 바꾼다.

## 7. 확인

```bash
npm test          # 373개 항목이 전부 일치해야 한다
```
