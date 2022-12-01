import {
    SkillQueueSegment,
    SkillQueueSegmentItem,
    calculate_queue_duration,
    iter_queue_duration,
    get_relevant_attributes,
    optimize_segment,
} from "./optimizer2";

test("iter_queue_duration", () => {
    const items: SkillQueueSegmentItem[] = [
        {id: 20342, level: 5, sp_to_finish: 10200},
        {id: 24311, level: 5, sp_to_finish: 10200},
        {id: 3402, level: 5, sp_to_finish: 10200},
    ]; // Advanced Spaceship Command, Amarr Carrier, Science

    const iter = iter_queue_duration(items, [27, 21, 17, 17, 17], 0.0);
    expect(iter.next()).toStrictEqual({done: false, value: 24000.0});
    expect(iter.next()).toStrictEqual({done: false, value: 48000.0});
    expect(iter.next()).toStrictEqual({done: false, value: 64320.0});
    expect(iter.next()).toStrictEqual({done: true, value: undefined});
});

test("get_relevant_attributes", () => {
    const items: SkillQueueSegmentItem[] = [
        {id: 20342, level: 5, sp_to_finish: 10200},
        {id: 3402, level: 5, sp_to_finish: 10200},
        {id: 3348, level: 5, sp_to_finish: 1},
    ]; // Advanced Spaceship Command, Science, Leadership

    const g_r_a = get_relevant_attributes;

    expect(g_r_a(items)).toStrictEqual([true, true, true, true, true]);
    expect(g_r_a([items[0]])).toStrictEqual([false, false, true, true, false]);
    expect(g_r_a([items[1]])).toStrictEqual([true, true, false, false, false]);
    expect(g_r_a([items[2]])).toStrictEqual([false, false, false, true, true]);
    expect(g_r_a([items[0], items[1]])).toStrictEqual([true, true, true, true, false]);
    expect(g_r_a([items[1], items[2]])).toStrictEqual([true, true, false, true, true]);
});

test("optimize_segment: Perception/Willpower", () => {
    const items: SkillQueueSegmentItem[] = [
        {id: 20342, level: 5, sp_to_finish: 102000},
        {id: 3402, level: 5, sp_to_finish: 10200},
        {id: 3348, level: 5, sp_to_finish: 1},
    ]; // Advanced Spaceship Command, Science, Leadership
    const duration = calculate_queue_duration(items, [17, 17, 17, 17, 17], 0.0);

    const segment: SkillQueueSegment = {
        items,
        duration,
        attributes: [17, 17, 17, 17, 17],
        relevant_attributes: [true, true, true, true, true],
    };

    expect(optimize_segment(segment)).toStrictEqual({
        best_attributes: [17, 17, 27, 21, 17],
        best_duration: 187202.18181818182,
    });
});

test("optimize_segment: Intelligence/Memory", () => {
    const items: SkillQueueSegmentItem[] = [
        {id: 20342, level: 5, sp_to_finish: 10200},
        {id: 3402, level: 5, sp_to_finish: 102000},
        {id: 3348, level: 5, sp_to_finish: 1},
    ]; // Advanced Spaceship Command, Science, Leadership
    const duration = calculate_queue_duration(items, [17, 17, 17, 17, 17], 0.0);

    const segment: SkillQueueSegment = {
        items,
        duration,
        attributes: [17, 17, 17, 17, 17],
        relevant_attributes: [true, true, true, true, true],
    };

    expect(optimize_segment(segment)).toStrictEqual({
        best_attributes: [27, 21, 17, 17, 17],
        best_duration: 187202.35294117648,
    });
});

test("optimize_segment: per/wil easy", () => {
    const items: SkillQueueSegmentItem[] = [{id: 20342, level: 5, sp_to_finish: 10200}]; // Advanced Spaceship Command, Science, Leadership
    const duration = calculate_queue_duration(items, [17, 17, 17, 17, 17], 0.0);

    const segment: SkillQueueSegment = {
        items,
        duration,
        attributes: [27, 21, 17, 17, 17],
        relevant_attributes: [true, true, true, true, true],
    };

    expect(optimize_segment(segment)).toStrictEqual({
        best_attributes: [17, 17, 27, 21, 17],
        best_duration: 16320.0,
    });
});
