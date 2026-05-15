package psm_test

import (
	"os"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"wingert/backend/internal/psm"
)

const rebenCultureID = "2314eb9f-7207-409f-a0d4-89b6a1177363"

func TestParseXMLFiltersByCulture(t *testing.T) {
	f, err := os.Open("testdata/sample.xml")
	require.NoError(t, err)
	defer f.Close()

	batch, err := psm.ParseXML(f, rebenCultureID)
	require.NoError(t, err)

	// Only the Reben product (Aktuan) survives; NurApfel (Kernobst) is filtered out.
	require.Len(t, batch.Products, 1)
	assert.Equal(t, "4090", batch.Products[0].ID)
	assert.Equal(t, "Aktuan", batch.Products[0].Name)

	// Two substances referenced from Aktuan, none from NurApfel
	require.Len(t, batch.Substances, 2)
	sids := []uuid.UUID{batch.Substances[0].ID, batch.Substances[1].ID}
	assert.Contains(t, sids, uuid.MustParse("9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b"))
	assert.Contains(t, sids, uuid.MustParse("63c58a64-ed05-473a-a71d-1b266552e710"))

	// One pest from Aktuan
	require.Len(t, batch.Pests, 1)
	assert.Equal(t, "Falscher Mehltau der Rebe", batch.Pests[0].NameDE)

	require.Len(t, batch.ProductSubstances, 2)
	require.Len(t, batch.Indications, 1)
	require.NotNil(t, batch.Indications[0].WaitingPeriodDays)
	assert.Equal(t, 56, *batch.Indications[0].WaitingPeriodDays)
}

func TestParseXMLMapsDeadlines(t *testing.T) {
	xmlBody := `<?xml version="1.0" encoding="utf-8"?>
<PublicationData>
  <Products>
    <Product id="9999" wNbr="W-9999" name="Datumtest" exhaustionDeadline="2027-06-30" soldoutDeadline="2028-12-31" isSalePermission="false" terminationReason="">
      <ProductInformation>
        <Ingredient inPercent="50">
          <SubstanceType SubstanceType="active"/>
          <Substance primaryKey="9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b"/>
        </Ingredient>
        <Indication dosageFrom="1" dosageTo="1" waitingPeriod="14" expenditureForm="kg/ha" expenditureTo="">
          <Measure primaryKey="m"/>
          <Culture primaryKey="2314eb9f-7207-409f-a0d4-89b6a1177363" additionalTextPrimaryKey=""/>
          <Pest primaryKey="0251feea-4e71-4881-8b0a-09874f39277a" additionalTextPrimaryKey="" type="fungus"/>
        </Indication>
      </ProductInformation>
    </Product>
  </Products>
  <Parallelimports/>
  <MetaData>
    <Detail primaryKey="9d9a5c3d-1941-4fc3-9111-1fe4cd86e28b">
      <Description value="Cymoxanil" language="de"/>
    </Detail>
  </MetaData>
  <MetaData>
    <Detail primaryKey="0251feea-4e71-4881-8b0a-09874f39277a">
      <Description value="Falscher Mehltau der Rebe" language="de"/>
    </Detail>
  </MetaData>
</PublicationData>`
	batch, err := psm.ParseXML(strings.NewReader(xmlBody), rebenCultureID)
	require.NoError(t, err)
	require.Len(t, batch.Products, 1)
	require.NotNil(t, batch.Products[0].ExhaustionDeadline)
	assert.Equal(t, 2027, batch.Products[0].ExhaustionDeadline.Year())
	require.NotNil(t, batch.Products[0].SoldoutDeadline)
	assert.Equal(t, 2028, batch.Products[0].SoldoutDeadline.Year())
}
