import { useMemo, useState } from 'react';
import { useMutation } from 'react-query';
import { useRouter } from 'next/router';

import Button from '@oracle/elements/Button';
import Divider from '@oracle/elements/Divider';
import FlexContainer from '@oracle/components/FlexContainer';
import Headline from '@oracle/elements/Headline';
import Paginate from '@components/shared/Paginate';
import PipelineDetailPage from '@components/PipelineDetailPage';
import PipelineRunsTable from '@components/PipelineDetail/Runs/Table';
import PipelineRunType from '@interfaces/PipelineRunType';
import PipelineScheduleType, {
  SCHEDULE_TYPE_TO_LABEL,
  ScheduleStatusEnum,
  ScheduleTypeEnum,
} from '@interfaces/PipelineScheduleType';
import PipelineType from '@interfaces/PipelineType';
import PipelineVariableType from '@interfaces/PipelineVariableType';
import Spacing from '@oracle/elements/Spacing';
import Table from '@components/shared/Table';
import Text from '@oracle/elements/Text';
import api from '@api';
import buildTableSidekick, { TABS } from '@components/PipelineRun/shared/buildTableSidekick';
import { BeforeStyle } from '@components/PipelineDetail/shared/index.style';
import {
  PADDING_UNITS,
  UNIT,
  UNITS_BETWEEN_SECTIONS,
} from '@oracle/styles/units/spacing';
import {
  CalendarDate,
  MultiShare,
  MusicNotes,
  Pause,
  PlayButtonFilled,
  Schedule,
  Sun,
  Switch,
} from '@oracle/icons';
import { PageNameEnum } from '@components/PipelineDetailPage/constants';
import { PROVIDER_EVENTS_BY_UUID } from '@interfaces/EventMatcherType';
import {
  addTriggerVariables,
  getFormattedVariable,
  getFormattedVariables,
} from '@components/Sidekick/utils';
import { createBlockStatus } from '../utils';
import { isEmptyObject } from '@utils/hash';
import { onSuccess } from '@api/utils/response';
import { pauseEvent } from '@utils/events';
import { queryFromUrl, queryString } from '@utils/url';

type TriggerDetailProps = {
  fetchPipelineSchedule: () => void;
  pipeline: PipelineType;
  pipelineSchedule?: PipelineScheduleType;
  variables?: PipelineVariableType[];
};

const LIMIT = 30;

function TriggerDetail({
  fetchPipelineSchedule,
  pipeline,
  pipelineSchedule,
  variables,
}: TriggerDetailProps) {
  const router = useRouter();
  const {
    uuid: pipelineUUID,
  } = pipeline || {};
  const {
    id: pipelineScheduleID,
    event_matchers: eventMatchers,
    name: pipelineScheduleName,
    schedule_interval: scheduleInterval,
    schedule_type: scheduleType,
    start_time: startTime,
    status,
    variables: scheduleVariablesInit = {},
  } = pipelineSchedule || {};

  const q = queryFromUrl();

  const {
    data: dataPipelineRuns,
    mutate: fetchPipelineRuns,
  } = api.pipeline_runs.pipeline_schedules.list(pipelineScheduleID, {
    _limit: LIMIT,
    _offset: (q?.page ? q.page : 0) * LIMIT,
  }, {
    refreshInterval: 3000,
    revalidateOnFocus: true,
  });
  const pipelineRuns = useMemo(() => dataPipelineRuns?.pipeline_runs || [], [dataPipelineRuns]);
  const totalRuns = useMemo(() => dataPipelineRuns?.total_count || [], [dataPipelineRuns]);

  const [selectedRun, setSelectedRun] = useState<PipelineRunType>(null);
  const tablePipelineRuns = useMemo(() => {
    const page = q?.page ? q.page : 0;

    return (
      <>
        <PipelineRunsTable
          fetchPipelineRuns={fetchPipelineRuns}
          onClickRow={(rowIndex: number) => setSelectedRun((prev) => {
            const run = pipelineRuns[rowIndex];

            return prev?.id !== run.id ? run : null
          })}
          pipelineRuns={pipelineRuns}
          selectedRun={selectedRun}
        />
        <Spacing p={2}>
          <Paginate
            page={Number(page)}
            maxPages={9}
            onUpdate={(p) => {
              const newPage = Number(p);
              const updatedQuery = {
                ...q,
                page: newPage >= 0 ? newPage : 0,
              }
              router.push(
                '/pipelines/[pipeline]/triggers/[...slug]',
                `/pipelines/${pipelineUUID}/triggers/${pipelineScheduleID}?${queryString(updatedQuery)}`,
              );
            }}
            totalPages={Math.ceil(totalRuns / LIMIT)}
          />
        </Spacing>
      </>
    )
  }, [
    fetchPipelineRuns,
    pipeline,
    pipelineRuns,
    selectedRun,
  ]);

  const [selectedTab, setSelectedTab] = useState(TABS[0]);

  const [updatePipelineSchedule, { isLoading: isLoadingUpdatePipelineSchedule }] = useMutation(
    (pipelineSchedule: PipelineScheduleType) =>
      api.pipeline_schedules.useUpdate(pipelineSchedule.id)({
        pipeline_schedule: pipelineSchedule,
      }),
    {
      onSuccess: (response: any) => onSuccess(
        response, {
          callback: () => {
            fetchPipelineSchedule();
          },
          onErrorCallback: ({
            error: {
              errors,
              message,
            },
          }) => {
            console.log(errors, message);
          },
        },
      ),
    },
  );

  const isActive = useMemo(() => ScheduleStatusEnum.ACTIVE === status, [status]);

  const detailsMemo = useMemo(() => {
    const iconProps = {
      default: true,
      size: 1.5 * UNIT,
    };

    const rows = [
      [
        <FlexContainer alignItems="center">
          <MultiShare {...iconProps} />
          <Spacing mr={1} />
          <Text default>
            Trigger type
          </Text>
        </FlexContainer>,
        <Text monospace>
          {SCHEDULE_TYPE_TO_LABEL[scheduleType]?.()}
        </Text>
      ],
      [
        <FlexContainer alignItems="center">
          <Switch {...iconProps} />
          <Spacing mr={1} />
          <Text default>
            Status
          </Text>
        </FlexContainer>,
        <Text
          danger={!isActive}
          monospace
          success={isActive}
        >
          {status}
        </Text>
      ],
    ];

    if (scheduleInterval) {
      rows.push([
        <FlexContainer alignItems="center">
          <Schedule {...iconProps} />
          <Spacing mr={1} />
          <Text default>
            Frequency
          </Text>
        </FlexContainer>,
        <Text monospace>
          {scheduleInterval.replace('@', '')}
        </Text>
      ]);
    }

    if (startTime) {
      rows.push([
        <FlexContainer alignItems="center">
          <CalendarDate {...iconProps} />
          <Spacing mr={1} />
          <Text default>
            Start date
          </Text>
        </FlexContainer>,
        <Text monospace>
          {startTime}
        </Text>,
      ]);
    }

    return (
      <Table
        columnFlex={[null, 1]}
        rows={rows}
      />
    );
  }, [
    isActive,
    scheduleInterval,
    startTime,
    scheduleType,
  ]);

  const scheduleVariables = useMemo(() => scheduleVariablesInit || {}, [scheduleVariablesInit]);
  const variablesTable = useMemo(() => {
    let arr = [];

    if (!isEmptyObject(scheduleVariables)) {
      Object.entries(scheduleVariables).forEach(([k, v]) => {
        arr.push({
          uuid: k,
          value: getFormattedVariable(v),
        });
      });
    } else {
      arr = getFormattedVariables(variables, block => block.uuid === 'global');
    }
    
    arr = addTriggerVariables(arr || [], scheduleType);

    if (typeof arr === 'undefined' || !arr?.length) {
      return null;
    }

    return (
      <Table
        columnFlex={[null, 1]}
        rows={arr.map(({
          uuid,
          value,
        }) => [
          <Text default monospace small>
            {uuid}
          </Text>,
          <Text monospace small>
            {value}
          </Text>,
        ])}
      />
    );
  }, [
    scheduleType,
    scheduleVariablesInit,
    variables,
  ]);

  const eventsTable = useMemo(() => (
    <Table
      columnFlex={[null, 1]}
      columns={[
        {
          uuid: 'Provider',
        },
        {
          uuid: 'Event',
        }
      ]}
      rows={eventMatchers?.map(({
        event_type: eventType,
        name,
      }) => [
        <Text default monospace>
          {PROVIDER_EVENTS_BY_UUID[eventType].label()}
        </Text>,
        <Text monospace>
          {name}
        </Text>,
      ])}
    />
  ), [eventMatchers]);

  return (
    <PipelineDetailPage
      afterHidden={!selectedRun}
      before={(
        <BeforeStyle>
          <Spacing
            mb={UNITS_BETWEEN_SECTIONS}
            pt={PADDING_UNITS}
            px={PADDING_UNITS}
          >
            <Spacing mb={PADDING_UNITS}>
              {ScheduleTypeEnum.TIME === scheduleType && (
                <Sun size={5 * UNIT} />
              )}
              {ScheduleTypeEnum.EVENT === scheduleType && (
                <MusicNotes size={5 * UNIT} />
              )}
              {!scheduleType && (
                <MultiShare size={5 * UNIT} />
              )}
            </Spacing>

            <Headline>
              {pipelineScheduleName}
            </Headline>
          </Spacing>

          <Spacing px={PADDING_UNITS}>
            <Headline level={5}>
              Settings
            </Headline>
          </Spacing>

          <Divider light mt={1} short />

          {detailsMemo}

          {eventMatchers?.length >= 1 && (
            <Spacing my={UNITS_BETWEEN_SECTIONS}>
              <Spacing px={PADDING_UNITS}>
                <Headline level={5}>
                  Events
                </Headline>
              </Spacing>

              <Divider light mt={1} short />

              {eventsTable}
            </Spacing>
          )}

          {variablesTable && (
            <Spacing my={UNITS_BETWEEN_SECTIONS}>
              <Spacing px={PADDING_UNITS}>
                <Headline level={5}>
                  Runtime variables
                </Headline>
              </Spacing>

              <Divider light mt={1} short />

              {variablesTable}
            </Spacing>
          )}
        </BeforeStyle>
      )}
      beforeWidth={34 * UNIT}
      breadcrumbs={[
        {
          label: () => 'Triggers',
          linkProps: {
            as: `/pipelines/${pipelineUUID}/triggers`,
            href: '/pipelines/[pipeline]/triggers',
          },
        },
        {
          label: () => pipelineScheduleName,
          linkProps: {
            as: `/pipelines/${pipelineUUID}/triggers/${pipelineScheduleID}`,
            href: '/pipelines/[pipeline]/triggers/[...slug]',
          },
        },
      ]}
      buildSidekick={props => buildTableSidekick({
        ...props,
        selectedRun,
        selectedTab,
        setSelectedTab,
      })}
      pageName={PageNameEnum.TRIGGERS}
      pipeline={pipeline}
      subheader={(
        <FlexContainer alignItems="center">
          <Button
            beforeIcon={isActive
              ? <Pause size={2 * UNIT} />
              : <PlayButtonFilled inverted size={2 * UNIT} />
            }
            danger={isActive}
            loading={isLoadingUpdatePipelineSchedule}
            onClick={(e) => {
              pauseEvent(e);
              updatePipelineSchedule({
                id: pipelineScheduleID,
                status: isActive
                  ? ScheduleStatusEnum.INACTIVE
                  : ScheduleStatusEnum.ACTIVE
              });
            }}
            outline
            success={!isActive}
          >
            {isActive
              ? 'Pause trigger'
              : 'Start trigger'
            }
          </Button>

          <Spacing mr={PADDING_UNITS} />

          <Button
            linkProps={{
              as: `/pipelines/${pipelineUUID}/triggers/${pipelineScheduleID}/edit`,
              href: '/pipelines/[pipeline]/triggers/[...slug]',
            }}
            noHoverUnderline
            outline
            sameColorAsText
          >
            Edit trigger
          </Button>
        </FlexContainer>
      )}
      title={() => pipelineScheduleName}
      uuid="triggers/detail"
    >
      <Spacing mt={PADDING_UNITS} px={PADDING_UNITS}>
        <Headline level={5}>
          Runs for this trigger
        </Headline>
      </Spacing>

      <Divider light mt={PADDING_UNITS} short />

      {tablePipelineRuns}
    </PipelineDetailPage>
  );
}

export default TriggerDetail;
